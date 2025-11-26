/*******************************************************************
 * FormatarFotos.gs — Utilitários para processamento de imagens
 * Compressão, redimensionamento, conversão e normalização
 *******************************************************************/

var FormatarFotos = (function () {

  /***************************************************************
   * Converte Blob → Base64 seguro
   ***************************************************************/
  function blobToBase64(blob) {
    try {
      if (!blob) {
        Logger.log("blobToBase64: blob vazio");
        return "";
      }

      var base64 = Utilities.base64Encode(blob.getBytes());
      
      Logger.log("blobToBase64: conversão concluída (" + base64.length + " chars)");
      return base64;

    } catch (err) {
      Logger.log("❌ ERRO blobToBase64: " + err);
      return "";
    }
  }

  /***************************************************************
   * Redimensiona imagens (APENAS PNG ou JPEG)
   * maxWidth / maxHeight limitam o tamanho
   ***************************************************************/
  function resizeImage(blob, maxWidth, maxHeight) {
    try {
      if (!blob) {
        Logger.log("resizeImage: blob vazio");
        return blob;
      }

      var contentType = blob.getContentType();
      if (!["image/png", "image/jpeg"].includes(contentType)) {
        Logger.log("resizeImage: formato não suportado → " + contentType);
        return blob;
      }

      var image = ImagesService.openImage(blob);

      var width = image.getWidth();
      var height = image.getHeight();
      Logger.log("resizeImage: dimensões originais = " + width + "x" + height);

      // Cálculo proporcional
      var ratio = Math.min(maxWidth / width, maxHeight / height, 1);

      var newWidth = Math.round(width * ratio);
      var newHeight = Math.round(height * ratio);

      Logger.log("resizeImage: nova dimensão = " + newWidth + "x" + newHeight);

      var resized = image.resize(newWidth, newHeight);
      return resized.getBlob();

    } catch (err) {
      Logger.log("❌ ERRO resizeImage: " + err);
      return blob;
    }
  }

  /***************************************************************
   * Compressão de imagem ajustando qualidade (JPEG)
   ***************************************************************/
  function compressImage(blob, quality) {
    try {
      if (!blob) {
        Logger.log("compressImage: blob vazio");
        return blob;
      }

      var contentType = blob.getContentType();
      if (contentType !== "image/jpeg") {
        Logger.log("compressImage: formato não é JPEG → ignorado");
        return blob;
      }

      quality = Math.min(Math.max(quality, 1), 100); // clamp 1 a 100

      Logger.log("compressImage: qualidade = " + quality);

      var image = ImagesService.openImage(blob);

      var compressed = image.setQuality(quality);
      return compressed.getBlob();

    } catch (err) {
      Logger.log("❌ ERRO compressImage: " + err);
      return blob;
    }
  }

  /***************************************************************
   * Pipeline completo:
   *   1. Redimensiona
   *   2. Comprime
   *   3. Converte para Base64
   ***************************************************************/
  function processarFoto(blob, maxWidth, maxHeight, quality) {
    try {
      Logger.log("processarFoto: iniciando processamento…");

      var resized = resizeImage(blob, maxWidth, maxHeight);
      var compressed = compressImage(resized, quality);
      var base64 = blobToBase64(compressed);

      Logger.log("processarFoto: finalizado com base64 = " + base64.length + " chars");

      return base64;

    } catch (err) {
      Logger.log("❌ ERRO processarFoto: " + err);
      return "";
    }
  }

  /***************************************************************
   * Exposto publicamente
   ***************************************************************/
  return {
    blobToBase64: blobToBase64,
    resizeImage: resizeImage,
    compressImage: compressImage,
    processarFoto: processarFoto
  };

})();
