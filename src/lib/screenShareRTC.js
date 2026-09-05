// Transmissão: WebRTC peer-to-peer entre dois dispositivos — o vídeo NUNCA passa pelo
// servidor, só a sinalização inicial (offer/answer/candidatos ICE), via
// src/lib/screenShareSignals.js (polling, mesmo padrão dos comandos remotos). Só STUN público
// (sem TURN) — funciona bem na mesma rede/Wi-Fi ou na maioria das redes domésticas; redes bem
// restritivas (algumas corporativas/operadoras) podem não conseguir conectar direto.

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const POLL_MS = 1500;

async function sendSignal(fromDevice, toDevice, kind, payload) {
  await fetch("/api/screen-share/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fromDevice, toDevice, kind, payload }),
  }).catch(() => {}); // sinal perdido tenta nada — próximo ciclo de qualquer lado ainda pode salvar a conexão
}

function pollSignals({ myDevice, alsoHost, onSignal, onError }) {
  let sinceRef = null;
  let cancelled = false;
  const tick = async () => {
    try {
      const qs = new URLSearchParams({ deviceId: myDevice, ...(alsoHost ? { alsoHost: "1" } : {}), ...(sinceRef ? { since: sinceRef } : {}) });
      const res = await fetch(`/api/screen-share/signal/recent?${qs}`);
      const data = await res.json();
      if (cancelled || !data?.ok) return;
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

/** Lado de quem está COMPARTILHANDO a tela (Modo Tela + Transmissão ligados). Escuta pedidos
 * de outros dispositivos querendo assistir e abre uma conexão (uma por espectador). */
export function hostScreenShare({ deviceId, stream, onLog }) {
  const peers = new Map(); // viewerId → RTCPeerConnection

  const closePeer = (viewerId) => { peers.get(viewerId)?.close(); peers.delete(viewerId); };

  const handleWatchRequest = async (viewerId) => {
    closePeer(viewerId); // pedido novo do mesmo espectador (ex.: recarregou a página) — recomeça limpo
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
    alsoHost: true,
    onSignal: async (s) => {
      const pc = peers.get(s.from_device);
      if (s.kind === "watch-request") await handleWatchRequest(s.from_device).catch((err) => onLog?.(`falha ao atender espectador: ${err.message}`));
      else if (s.kind === "answer" && pc) await pc.setRemoteDescription(s.payload.sdp).catch(() => {});
      else if (s.kind === "ice" && pc) await pc.addIceCandidate(s.payload.candidate).catch(() => {});
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

/** Lado de quem quer ASSISTIR a tela de outro dispositivo — Modo Vigia, "assistir ao vivo". */
export function viewerWatchScreen({ deviceId, onTrack, onStatus, onLog }) {
  let pc = null;
  let hostId = null;
  const pendingCandidates = []; // podem chegar antes do setRemoteDescription (corrida do polling)

  const ensurePc = () => {
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => { if (e.candidate && hostId) sendSignal(deviceId, hostId, "ice", { candidate: e.candidate }); };
    pc.ontrack = (e) => {
      onLog?.(`faixa recebida: ${e.track.kind}, estado=${e.track.readyState}, mudo=${e.track.muted}, streams=${e.streams.length}`);
      onTrack?.(e.streams[0]);
    };
    pc.onconnectionstatechange = () => onStatus?.(pc.connectionState);
    pc.oniceconnectionstatechange = () => onLog?.(`ICE: ${pc.iceConnectionState}`);
    return pc;
  };

  sendSignal(deviceId, "HOST", "watch-request", {});
  onStatus?.("procurando");

  const stopPoll = pollSignals({
    myDevice: deviceId,
    alsoHost: false,
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
    stop() {
      stopPoll();
      if (hostId) sendSignal(deviceId, hostId, "stop", {});
      pc?.close();
      pc = null;
    },
  };
}
