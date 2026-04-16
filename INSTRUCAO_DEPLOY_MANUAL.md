# 🚨 DEPLOY MANUAL NECESSÁRIO

## **Problema:** CORS não está funcionando mesmo após `clasp push`

## **Solução: Deploy Manual no Google Apps Script**

### **Passo 1: Acessar o GAS**
1. Abra: https://script.google.com/macros/s/AKfycbyUvvuE7vBILSUPl-pWoRO95KAa5wJ6ln0E_tboRxqBE3xeYDnVNC4lNj00PXPu5-VH/exec/edit

### **Passo 2: Verificar Código**
1. Verifique se o código em `App.js` contém os headers CORS:
```javascript
return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
```

### **Passo 3: Fazer Novo Deploy**
1. Clique em **Deploy > New Deployment**
2. Configure como **Web App**
3. **Execute as:** Me (seu email)
4. **Who has access:** Anyone
5. Clique em **Deploy**
6. **Copie a nova URL** e atualize no `ui/backend-shim.js`

### **Passo 4: Atualizar Frontend**
1. Abra `ui/backend-shim.js`
2. Atualize a variável `BACKEND_API_URL` com a nova URL
3. Faça commit e push

## **Teste Após Deploy:**
1. Acesse: `https://luccafamga.github.io/RRT-faMga/test-cors-imediato.html`
2. Deve mostrar `✅ SUCESSO!`

## **Se Ainda Falhar:**
O problema pode estar nas configurações do projeto GAS ou na versão do deployment.

**Faça o deploy manual e me diga o resultado!**
