const API_BASE_URL = 'https://api.ilovepdf.com/v1';

function getCredentials() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY;
  const secretKey = process.env.ILOVEPDF_SECRET_KEY;
  const region = process.env.ILOVEPDF_REGION || 'eu';

  if (!publicKey || !secretKey) {
    throw new Error('Faltan credenciales de iLovePDF en el archivo .env');
  }

  return { publicKey, secretKey, region };
}

export async function authenticateIlovePdf() {
  const { publicKey, secretKey } = getCredentials();

  const response = await fetch(`${API_BASE_URL}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      public_key: publicKey,
      secret_key: secretKey,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error autenticando con iLovePDF: ${response.status} ${JSON.stringify(data)}`);
  }

  if (!data.token) {
    throw new Error('iLovePDF no devolvió token de autenticación');
  }

  return data.token;
}

export async function startIlovePdfTask(token, tool) {
  const { region } = getCredentials();

  const response = await fetch(`${API_BASE_URL}/start/${tool}/${region}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error creando tarea ${tool}: ${response.status} ${JSON.stringify(data)}`);
  }

  if (!data.server || !data.task) {
    throw new Error(`iLovePDF no devolvió server o task para la herramienta ${tool}`);
  }

  return {
    server: data.server,
    task: data.task,
  }; 
}

export async function uploadFileToIlovePdf(
  token,
  server,
  task,
  fileBuffer,
  filename,
  mimeType = 'application/pdf',
) {
  const formData = new FormData();

  formData.append('task', task);
  formData.append(
    'file',
    new Blob([fileBuffer], { type: mimeType }),
    filename
  );

  const response = await fetch(`https://${server}/v1/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error subiendo archivo: ${response.status} ${JSON.stringify(data)}`);
  }

  if (!data.server_filename) {
    throw new Error('iLovePDF no devolvió server_filename');
  }

  return data.server_filename;
}

export async function processIlovePdfTask(token, server, task, tool, files, options = {}) {
  const response = await fetch(`https://${server}/v1/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task,
      tool,
      files,
      ...options,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error procesando tarea ${tool}: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

export async function downloadIlovePdfResult(token, server, task) {
  const response = await fetch(`https://${server}/v1/download/${task}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error descargando resultado: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
