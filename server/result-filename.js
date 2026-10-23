// The database ID is stable and unique, without exposing the private QR token.
export const resultFilename = (id, extension = 'png') => `photobooth_kartini_${String(id).padStart(6, '0')}.${extension}`
