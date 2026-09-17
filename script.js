/* =========================================================
   ELEMENTOS
   ========================================================= */
const video        = document.getElementById('video');
const btnCamera    = document.getElementById('btn-camera');
const btnLer       = document.getElementById('btn-ler');
const btnRepetir   = document.getElementById('btn-repetir');
const btnPararVoz  = document.getElementById('btn-parar-audio');
const btnLanterna  = document.getElementById('btn-lanterna');
const btnFechar    = document.getElementById('btn-fechar');
const linhaExtra   = document.getElementById('linha-extra');
const labelCont    = document.getElementById('label-continuo');
const chkCont      = document.getElementById('chk-continuo');
const statusEl     = document.getElementById('status');

/* =========================================================
   ESTADO
   ========================================================= */
let stream        = null;
let trackVideo    = null;
let cameraLigada  = false;
let ocupado       = false;
let modoContinuo  = false;
let timerContinuo = null;
let ultimoTexto   = '';
let workerPromise = null;
let torchLigado   = false;
let wakeLock      = null;

function definirStatus(txt){
  statusEl.textContent = txt;
}

/* =========================================================
   VERIFICAÇÃO DE AMBIENTE (HTTPS)
   ========================================================= */
if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  document.getElementById('aviso-seguranca').style.display = 'block';
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

/* =========================================================
   CÂMERA
   ========================================================= */
async function abrirCamera(){
  btnCamera.disabled = true;
  definirStatus('Abrindo a câmera...');

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    trackVideo   = stream.getVideoTracks()[0];
    cameraLigada = true;

    video.style.display      = 'block';
    btnCamera.style.display  = 'none';
    btnLer.style.display     = 'block';
    btnFechar.style.display  = 'block';
    linhaExtra.style.display = 'flex';
    labelCont.style.display  = 'flex';

    try {
      const caps = trackVideo.getCapabilities ? trackVideo.getCapabilities() : {};
      btnLanterna.style.display = (caps && caps.torch) ? 'block' : 'none';
    } catch (e) { btnLanterna.style.display = 'none'; }

    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}

    definirStatus('Câmera ligada. Aponte para o texto, deixe bem reto e toque em “LER EM VOZ ALTA”.');

    prepararOCR().catch(() => {});

  } catch (err) {
    console.error(err);
    btnCamera.disabled = false;

    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
      definirStatus('Permissão de câmera negada.\nAutorize o acesso à câmera nas configurações do navegador e recarregue a página.');
    } else if (err && err.name === 'NotFoundError') {
      definirStatus('Nenhuma câmera foi encontrada neste aparelho.');
    } else if (!window.isSecureContext) {
      definirStatus('A página precisa estar em HTTPS para usar a câmera.');
    } else {
      definirStatus('Não foi possível abrir a câmera. Verifique as permissões e tente novamente.');
    }
  }
}

function fecharCamera(){
  modoContinuo = false;
  chkCont.checked = false;
  clearTimeout(timerContinuo);

  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
  trackVideo   = null;
  cameraLigada = false;
  ocupado      = false;
  torchLigado  = false;

  if (wakeLock) { try { wakeLock.release(); } catch(e){} wakeLock = null; }

  video.style.display       = 'none';
  btnCamera.style.display   = 'block';
  btnCamera.disabled        = false;
  btnLer.style.display      = 'none';
  btnLer.disabled           = false;
  btnFechar.style.display   = 'none';
  btnLanterna.style.display = 'none';
  linhaExtra.style.display  = 'none';
  labelCont.style.display   = 'none';

  definirStatus('Câmera desligada. Toque em “ABRIR CÂMERA” para começar de novo.');
}

/* =========================================================
   OCR
   ========================================================= */
function prepararOCR(){
  if (workerPromise) return workerPromise;

  definirStatus('Preparando o leitor de texto... (só na primeira vez, pode levar alguns segundos)');

  workerPromise = Tesseract.createWorker('por', 1, {
    logger: m => {
      if (m && m.status === 'recognizing text') {
        definirStatus('Lendo texto... ' + Math.round(m.progress * 100) + '%');
      }
    }
  })
  .then(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: '6' });
    return w;
  })
  .catch(err => {
    console.error('Falha ao iniciar o OCR:', err);
    workerPromise = null;
    throw err;
  });

  return workerPromise;
}

/* =========================================================
   PRÉ-PROCESSAMENTO DA IMAGEM
   ========================================================= */
function prepararImagem(){
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  let escala = 1600 / Math.max(vw, vh);
  escala = Math.max(1, Math.min(2, escala));

  const w = Math.round(vw * escala);
  const h = Math.round(vh * escala);

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const contraste  = 1.6;
  const intercepto = 128 * (1 - contraste);

  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    g = g * contraste + intercepto;
    d[i] = d[i + 1] = d[i + 2] = g < 0 ? 0 : (g > 255 ? 255 : g);
  }
  ctx.putImageData(img, 0, 0);

  return canvas;
}

/* =========================================================
   LIMPEZA DO TEXTO
   ========================================================= */
function limparTexto(t){
  return t
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.replace(/[^0-9A-Za-zÀ-ÿ]/g, '').length >= 2)
    .join('\n')
    .trim();
}

/* =========================================================
   VOZ
   ========================================================= */
function falar(texto){
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return; }

    window.speechSynthesis.cancel();

    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang  = 'pt-BR';
    fala.rate  = 0.9;
    fala.pitch = 1;

    const vozes = window.speechSynthesis.getVoices();
    const voz = vozes.find(v => v.lang === 'pt-BR')
             || vozes.find(v => v.lang && v.lang.toLowerCase().startsWith('pt'));
    if (voz) fala.voice = voz;

    let finalizado = false;
    const fim = () => { if (!finalizado) { finalizado = true; resolve(); } };

    fala.onend   = fim;
    fala.onerror = fim;

    const limite = Math.max(8000, texto.length * 130);
    setTimeout(fim, limite);

    window.speechSynthesis.speak(fala);
  });
}

/* =========================================================
   CAPTURAR + LER
   ========================================================= */
async function capturarELer(){
  if (ocupado || !cameraLigada) return;

  if (video.readyState < 2 || !video.videoWidth) {
    definirStatus('A câmera ainda está iniciando. Aguarde um instante e tente de novo.');
    return;
  }

  ocupado = true;
  btnLer.disabled = true;
  if (navigator.vibrate) navigator.vibrate(60);

  try {
    const canvas = prepararImagem();
    definirStatus('Processando imagem...');

    const worker = await prepararOCR();
    const resultado = await worker.recognize(canvas);
    const texto = limparTexto(resultado.data.text || '');

    if (!texto) {
      ultimoTexto = '';
      definirStatus('Nenhum texto legível encontrado.\nAproxime mais a câmera, melhore a iluminação e mantenha o papel reto.');
    } else {
      ultimoTexto = texto;
      definirStatus(texto);
      await falar(texto);
    }
  } catch (err) {
    console.error(err);
    definirStatus('Erro ao processar a imagem. Verifique a conexão com a internet e tente novamente.');
  } finally {
    btnLer.disabled = false;
    ocupado = false;

    if (modoContinuo && cameraLigada) {
      clearTimeout(timerContinuo);
      timerContinuo = setTimeout(capturarELer, 1200);
    }
  }
}

/* =========================================================
   EVENTOS
   ========================================================= */
btnCamera.addEventListener('click', abrirCamera);
btnLer.addEventListener('click', capturarELer);
btnFechar.addEventListener('click', fecharCamera);

btnRepetir.addEventListener('click', () => {
  if (!ultimoTexto) {
    definirStatus('Ainda não há texto lido para repetir.');
    return;
  }
  definirStatus(ultimoTexto);
  falar(ultimoTexto);
});

btnPararVoz.addEventListener('click', () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
});

btnLanterna.addEventListener('click', async () => {
  if (!trackVideo) return;
  torchLigado = !torchLigado;
  try {
    await trackVideo.applyConstraints({ advanced: [{ torch: torchLigado }] });
    btnLanterna.textContent = torchLigado ? '🔦 Desligar lanterna' : '🔦 Ligar lanterna';
  } catch (e) {
    console.error(e);
    btnLanterna.style.display = 'none';
  }
});

chkCont.addEventListener('change', () => {
  modoContinuo = chkCont.checked;
  clearTimeout(timerContinuo);

  if (modoContinuo && cameraLigada && !ocupado) {
    capturarELer();
  }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && cameraLigada && 'wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
});

window.addEventListener('pagehide', () => {
  if (stream) stream.getTracks().forEach(t => t.stop());
});
