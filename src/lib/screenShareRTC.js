// Transmissão: WebRTC peer-to-peer entre dois dispositivos — o vídeo NUNCA passa pelo
// servidor, só a sinalização inicial (offer/answer/candidatos ICE), via
// src/lib/screenShareSignals.js (polling, mesmo padrão dos comandos remotos).
//
// STUN sozinho só ajuda os dois lados a DESCOBRIREM seu próprio endereço público — quando o
// NAT de um dos dois (comum em rede de operadora/4G, ou algumas redes corporativas) não deixa
// o outro lado alcançar esse endereço diretamente, a conexão fica presa em "checking" e cai
// pra "disconnected" sem nunca conectar (visto na prática: câmera de vigia entre duas redes
// diferentes). Por isso também tem um TURN público gratuito (Open Relay Project, sem
// cadastro) como reforço — ele retransmite o vídeo quando o caminho direto não existe. Ainda
// assim, sem controle sobre a disponibilidade desse serviço público; se algum dia parar de
// funcionar, a solução de verdade é um TURN próprio (ex.: coturn) ou um serviço pago (Twilio,
// Xirsys).
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];
// `channel` distingue qual "transmissão" é essa (hoje: "screen" ou "camera") — cada uma usa seu
// próprio pseudo-endereço de broadcast ('HOST:screen'/'HOST:camera'), pra dar pra ligar as duas
// ao mesmo tempo no mesmo dispositivo sem uma interferir na outra.

const POLL_MS = 1500;

async function sendSignal(fromDevice, toDevice, kind, payload) {
  await fetch("/api/screen-share/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fromDevice, toDevice, kind, payload }),
  }).catch(() => {}); // sinal perdido tenta nada — próximo ciclo de qualquer lado ainda pode salvar a conexão
}

function pollSignals({ myDevice, alsoAddress, onSignal, onError }) {
  let sinceRef = null;
  let bootstrapped = false; // 1ª checagem só marca o ponto de partida, não processa nada
  let cancelled = false;
  const tick = async () => {
    try {
      const qs = new URLSearchParams({ deviceId: myDevice, ...(alsoAddress ? { alsoAddress } : {}), ...(sinceRef ? { since: sinceRef } : {}) });
      const res = await fetch(`/api/screen-share/signal/recent?${qs}`);
      const data = await res.json();
      if (cancelled || !data?.ok) return;
      // sinalização é efêmera — um pedido de minutos atrás (de um teste anterior, por
      // exemplo) nunca deve importar agora. Sem isso, a consulta pega sempre os sinais MAIS
      // ANTIGOS primeiro (até um limite de linhas) e, depois de vários testes acumulando
      // sinais velhos endereçados ao mesmo pseudo-endereço de broadcast, uma conexão nova
      // nunca aparecia — ficava presa atrás da fila de lixo histórico.
      if (!bootstrapped) { bootstrapped = true; sinceRef = data.now; return; }
      sinceRef = data.now;
      for (const s of data.signals || []) onSignal(s);
    } catch (err) {
      if (!cancelled) onError?.(err);
    }
  };
  tick();
  const id = setInterval(tick, POLL_MS);
  return () => { cancelled = true; clearInterval(id); };
}

/** Lado de quem está TRANSMITINDO (Modo Tela + Transmissão, ou a Câmera de Vigia). Escuta
 * pedidos de outros dispositivos querendo assistir e abre uma conexão (uma por espectador).
 * `onChatMessage(text, fromViewerId)` — mensagens de texto mandadas por um espectador (ver
 * viewerWatchScreen abaixo), pra Lisa ler em voz alta e/ou exibir na tela de quem transmite. */
export function hostScreenShare({ deviceId, stream, channel = "screen", onLog, onChatMessage }) {
  const hostAddress = `HOST:${channel}`;
  const peers = new Map(); // viewerId → RTCPeerConnection

  const closePeer = (viewerId) => { peers.get(viewerId)?.close(); peers.delete(viewerId); };

  const handleWatchRequest = async (viewerId) => {
    // se já existe uma conexão SAUDÁVEL (ainda tentando ou já conectada) pra esse mesmo
    // espectador, ignora o pedido repetido — o espectador reenvia sozinho a cada poucos
    // segundos até parear (ver viewerWatchScreen), e conectar de verdade pode levar mais tempo
    // que isso (principalmente pelo TURN). Sem essa checagem, cada reenvio derrubava a conexão
    // em andamento antes dela terminar de se formar — um impasse que nunca conectava.
    const existing = peers.get(viewerId);
    if (existing && !["closed", "failed", "disconnected"].includes(existing.connectionState)) {
      onLog?.(`espectador ${viewerId.slice(0, 8)}: pedido repetido ignorado (conexão em ${existing.connectionState})`);
      return;
    }
    closePeer(viewerId); // só chega aqui se não tinha nada saudável — recomeça limpo
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.set(viewerId, pc);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal(deviceId, viewerId, "ice", { candidate: e.candidate }); };
    pc.onconnectionstatechange = () => {
      onLog?.(`espectador ${viewerId.slice(0, 8)}: ${pc.connectionState}`);
      if (["closed", "failed", "disconnected"].includes(pc.connectionState)) closePeer(viewerId);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(deviceId, viewerId, "offer", { sdp: offer });
  };

  const stopPoll = pollSignals({
    myDevice: deviceId,
    alsoAddress: hostAddress,
    onSignal: async (s) => {
      const pc = peers.get(s.from_device);
      if (s.kind === "watch-request") await handleWatchRequest(s.from_device).catch((err) => onLog?.(`falha ao atender espectador: ${err.message}`));
      else if (s.kind === "answer" && pc) await pc.setRemoteDescription(s.payload.sdp).catch(() => {});
      else if (s.kind === "ice" && pc) await pc.addIceCandidate(s.payload.candidate).catch(() => {});
      else if (s.kind === "chat") onChatMessage?.(s.payload.text, s.from_device);
      else if (s.kind === "stop") closePeer(s.from_device);
    },
    onError: (err) => onLog?.(`sinalização falhou: ${err.message}`),
  });

  return {
    stop() {
      stopPoll();
      for (const viewerId of [...peers.keys()]) closePeer(viewerId);
    },
  };
}

/** Lado de quem quer ASSISTIR a transmissão de outro dispositivo — Modo Vigia, "assistir ao
 * vivo". Devolve `sendChat(text)` pra mandar uma mensagem de volta pro dispositivo que
 * transmite (só funciona depois de parear com um host — ver onTrack/onStatus). */
export function viewerWatchScreen({ deviceId, onTrack, onStatus, onLog, channel = "screen" }) {
  let pc = null;
  let hostId = null;
  const pendingCandidates = []; // podem chegar antes do setRemoteDescription (corrida do polling)

  const dropConnection = () => {
    // conexão caiu (rede instável, ou o host trocou de câmera/tela e reiniciou a
    // transmissão) — solta tudo e volta a mandar watch-request sozinho, sem precisar
    // desligar/ligar manualmente pra reconectar.
    hostId = null;
    pc?.close();
    pc = null;
    pendingCandidates.length = 0;
    onStatus?.("procurando");
  };

  const ensurePc = () => {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => { if (e.candidate && hostId) sendSignal(deviceId, hostId, "ice", { candidate: e.candidate }); };
    pc.ontrack = (e) => {
      onLog?.(`faixa recebida: ${e.track.kind}, estado=${e.track.readyState}, mudo=${e.track.muted}, streams=${e.streams.length}`);
      onTrack?.(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      onStatus?.(pc.connectionState);
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) dropConnection();
    };
    pc.oniceconnectionstatechange = () => onLog?.(`ICE: ${pc.iceConnectionState}`);
    return pc;
  };

  // insiste (não manda só uma vez): se o espectador ligar ANTES do outro lado começar a
  // escutar de verdade (corrida de poucos segundos entre os dois toggles), OU se a conexão
  // cair depois (dropConnection acima zera hostId), reenviando sozinho a conexão se forma/
  // refaz sem precisar desligar/ligar manualmente. Intervalo de 8s (não 3s) de propósito —
  // conectar de verdade pode levar mais que alguns segundos (principalmente pelo TURN), e
  // insistir rápido demais só reiniciava a conexão antes dela terminar de se formar.
  const hostAddress = `HOST:${channel}`;
  sendSignal(deviceId, hostAddress, "watch-request", {});
  onStatus?.("procurando");
  const retryId = setInterval(() => { if (!hostId) sendSignal(deviceId, hostAddress, "watch-request", {}); }, 8000);

  const stopPoll = pollSignals({
    myDevice: deviceId,
    onSignal: async (s) => {
      if (s.kind === "offer") {
        hostId = s.from_device;
        const conn = ensurePc();
        await conn.setRemoteDescription(s.payload.sdp);
        for (const c of pendingCandidates.splice(0)) await conn.addIceCandidate(c).catch(() => {});
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        sendSignal(deviceId, hostId, "answer", { sdp: answer });
      } else if (s.kind === "ice" && s.from_device === hostId) {
        if (pc?.remoteDescription) await pc.addIceCandidate(s.payload.candidate).catch(() => {});
        else pendingCandidates.push(s.payload.candidate);
      }
    },
    onError: (err) => onLog?.(`sinalização falhou: ${err.message}`),
  });

  return {
    sendChat(text) {
      if (!hostId || !text?.trim()) return false;
      sendSignal(deviceId, hostId, "chat", { text: text.trim() });
      return true;
    },
    stop() {
      clearInterval(retryId);
      stopPoll();
      if (hostId) sendSignal(deviceId, hostId, "stop", {});
      pc?.close();
      pc = null;
    },
  };
}
