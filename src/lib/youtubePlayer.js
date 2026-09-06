// Modo Rádio: toca música de VERDADE do YouTube (áudio real, via IFrame Player API oficial do
// YouTube — não é extração/download, é o player embutido deles mesmo, sempre permitido). Só
// controla o QUE toca e escuta QUANDO termina; o áudio em si é 100% deles.

let apiPromise = null;

/** Carrega o script da IFrame API do YouTube uma única vez (reaproveita entre chamadas). */
export function loadYouTubeAPI() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prevReady?.(); resolve(window.YT); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/** Cria o player uma vez (dentro do elemento `el`) e devolve a instância pronta pra usar. */
export function createYouTubePlayer(el, { onStateChange } = {}) {
  return new Promise((resolve) => {
    const player = new window.YT.Player(el, {
      height: "112",
      width: "200",
      playerVars: { autoplay: 0, controls: 1, rel: 0 },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e) => onStateChange?.(e),
      },
    });
  });
}

/** Toca `videoId` e resolve quando o vídeo termina (ENDED) — é assim que o Modo Rádio sabe a
 * hora certa de comentar a música e seguir pro próximo bloco. */
export function playAndWaitEnded(player, videoId, stateHandlerRef) {
  return new Promise((resolve) => {
    stateHandlerRef.current = (e) => {
      if (e.data === window.YT.PlayerState.ENDED) {
        stateHandlerRef.current = null;
        resolve();
      }
    };
    player.loadVideoById(videoId);
  });
}
