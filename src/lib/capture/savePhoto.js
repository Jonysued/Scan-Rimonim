// Persist the image record before optional analysis. Retry updates the same record.
export async function savePhoto(client, foto, sessionId, variedadName, onSaved = () => {}) {
  const storage_uri = foto.storage_uri || (await client.integrations.Core.UploadPrivateFile({file: foto.file})).file_uri;
  foto.storage_uri = storage_uri;
  const photo = foto.photoId ? {id: foto.photoId} : await client.entities.Foto.create({
    session_id: sessionId, captured_at: new Date().toISOString(), storage_uri,
    capture_metadata: foto.metadata, measurement_status: 'unmeasured',
    status: 'procesando', fruit_count_estimate: null, avg_diameter_mm: null, fruits: [],
  });
  foto.photoId = photo.id;
  onSaved({photoId: photo.id, storage_uri});
  try {
    const {data} = await client.functions.invoke('analyzePhoto', {storage_uri, variedad_name: variedadName});
    const fruits = data.fruits || [];
    const values = {status: 'listo', fruits, fruit_count_estimate: data.fruit_count_estimate ?? fruits.length};
    await client.entities.Foto.update(photo.id, values);
    return {...values, photoId: photo.id, storage_uri};
  } catch (error) {
    // 'procesando' or 'error' both mean not analyzed; the saved record survives.
    await client.entities.Foto.update(photo.id, {status: 'error'}).catch(() => {});
    return {status: 'guardado', photoId: photo.id, storage_uri, analysisError: error.message};
  }
}
