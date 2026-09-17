// Lógica para acionar a câmera do celular
async function iniciarCamera() {
  const video = document.getElementById('video');
  const btnLer = document.getElementById('btn-ler');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment" } // Usa a câmera traseira do celular
    });
    video.srcObject = stream;
    video.style.display = 'block';
    btnLer.style.display = 'block';
  } catch (err) {
    alert("Erro ao acessar a câmera. Verifique as permissões do navegador.");
    console.error(err);
  }
}

// Lógica de síntese de voz (Text-to-Speech nativo do navegador)
function lerAviso() {
  // Simulação de leitura do texto impresso na clínica em Ribeirão Pires
  const textoSimulado = "Bem-vindo à clínica. Por favor, dirija-se à recepção para confirmar seu agendamento e retirar sua senha de atendimento.";
  
  document.getElementById('conteudo-texto').innerText = textoSimulado;

  // Verifica se o navegador suporta síntese de voz
  if ('speechSynthesis' in window) {
    const fala = new SpeechSynthesisUtterance(textoSimulado);
    fala.lang = 'pt-BR';
    fala.rate = 0.9; // Velocidade um pouco mais lenta para facilitar o entendimento
    window.speechSynthesis.speak(fala);
  } else {
    alert("Seu navegador não suporta leitura em voz alta.");
  }
}
