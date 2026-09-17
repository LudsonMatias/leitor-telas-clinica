async function iniciarCamera() {
  const video = document.getElementById('video');
  const btnLer = document.getElementById('btn-ler');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" } // Usa a câmera traseira
    });
    video.srcObject = stream;
    video.style.display = 'block';
    btnLer.style.display = 'block';
  } catch (err) {
    alert("Erro ao acessar a câmera. Verifique as permissões no navegador.");
    console.error(err);
  }
}

async function lerAvisoReal() {
  const video = document.getElementById('video');
  const conteudoTexto = document.getElementById('conteudo-texto');

  // Criar um canvas oculto para capturar a foto exata do vídeo
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  conteudoTexto.innerText = "Processando imagem... Aguarde alguns segundos.";

  try {
    // Processa a imagem usando OCR em Português
    const result = await Tesseract.recognize(canvas, 'por', {
      logger: m => {
        if (m.status === 'recognizing text') {
          conteudoTexto.innerText = `Lendo texto... ${Math.round(m.progress * 100)}%`;
        }
      }
    });

    const textoIdentificado = result.data.text.trim();

    if (!textoIdentificado || textoIdentificado.length === 0) {
      conteudoTexto.innerText = "Nenhum texto legível foi encontrado. Tente aproximar mais a câmera e focar no papel.";
      return;
    }

    // Exibe o texto real lido na tela
    conteudoTexto.innerText = textoIdentificado;

    // Converte o texto real lido em áudio
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Para áudios anteriores
      const fala = new SpeechSynthesisUtterance(textoIdentificado);
      fala.lang = 'pt-BR';
      fala.rate = 0.9;
      window.speechSynthesis.speak(fala);
    }
  } catch (erro) {
    console.error(erro);
    conteudoTexto.innerText = "Erro ao ler a imagem. Tente novamente com mais iluminação.";
  }
}
