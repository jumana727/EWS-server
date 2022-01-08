const express = require("express");
const cors = require("cors");
const app = express();

var axios = require("axios");
const localStorage = require("localStorage");


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const uuid = require("./utils/uuid");
const signature = require("./utils/request_signing");

const fs = require("fs");
const dateNow = new Date();

app.use(express.static("public"));

app.get("/", function (req, res) {
    res.send("Hello");
  });

app.get("/consent/:number", (req,res) =>{
    
    const expiry = new Date(dateNow.getTime() + 600000);
    const privateKey = fs.readFileSync("./keys/private_key.pem", {
        encoding: "utf8",
      });
    
    const number = req.params.number;
    console.log(number);
    var data = JSON.stringify({
        "ver": "1.0",
        "timestamp": dateNow.toISOString(),
        "txnid": uuid.create_UUID(),
        "ConsentDetail": {
          "consentStart": dateNow.toISOString(),
          "consentExpiry": expiry.toISOString(),
          "consentMode": "VIEW",
          "fetchType": "PERIODIC",
          "consentTypes": [
            "TRANSACTIONS",
            "PROFILE",
            "SUMMARY"
          ],
          "fiTypes": [
            "DEPOSIT"
          ],
          "DataConsumer": {
            "id": "FIU"
          },
          "Customer": {
            "id":  number + "@setu-aa" 
          },
          "Purpose": {
            "code": "102",
            "refUri": "https://api.rebit.org.in/aa/purpose/102.xml",
            "text": "Wealth management service",
            "Category": {
              "type": "string"
            }
          },
          "FIDataRange": {
            "from": "2019-04-11T11:39:57.153Z",
            "to": "2022-04-17T14:25:33.440Z"
          },
          "DataLife": {
            "unit": "MONTH",
            "value": 3
          },
          "Frequency": {
            "unit": "MONTH",
            "value": 10
          },
          "DataFilter": [
            {
              "type": "TRANSACTIONAMOUNT",
              "operator": ">=",
              "value": "10"
            }
          ]
        }
      });
      let detachedJWS = signature.makeDetachedJWS(privateKey, data);
      
      var config = {
        method: 'post',
        url: 'https://aa-sandbox.setu.co/Consent',
        headers: { 
          'client_api_key': '1b0a81b0-a783-45be-b99e-8f7f352420ff', 
          'x-jws-signature': detachedJWS, 
          'Content-Type': 'application/json'
        },
        data : data
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));
      })
      .catch(function (error) {
        console.log(error);
      });
      
});

app.get("/Consent/handle/:consentHandle", (req,res) =>{
    const handle = req.params.consentHandle;
    const privateKey = fs.readFileSync("./keys/private_key.pem", {
        encoding: "utf8",
      });
    let detachedJWS = signature.makeDetachedJWS(privateKey, "/Consent/handle/" + handle);
    
    var config = {
        method: 'get',
        url: 'https://aa-sandbox.setu.co/Consent/handle/'+handle,
        headers: { 
          'client_api_key': '1b0a81b0-a783-45be-b99e-8f7f352420ff', 
          'x-jws-signature': detachedJWS
        }
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));
        localStorage.setItem("consentid",JSON.stringify(response.data.ConsentStatus.id));
        console.log(localStorage.getItem("consentid"));
        
      })
      .catch(function (error) {
        console.log(error);
      });
});

app.get("/getConsent/:consentId",(req,res) =>{
    const id = req.params.consentId;
    const privateKey = fs.readFileSync("./keys/private_key.pem", {
        encoding: "utf8",
      });
    let detachedJWS = signature.makeDetachedJWS(privateKey, "/getConsent/" + id);
    var config = {
        method: 'get',
        url: 'https://aa-sandbox.setu.co/Consent/'+id,
        headers: { 
          'client_api_key': '1b0a81b0-a783-45be-b99e-8f7f352420ff', 
          'x-jws-signature': detachedJWS
        }
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));
        const consent = JSON.stringify(response.data.signedConsent);
        console.log(consent.split(".")[2]);
        localStorage.setItem("consent",consent.split(".")[2]);
      })
      .catch(function (error) {
        console.log(error);
      });
});

app.get("/generateKey",(req,res)=>{
    var config = {
        method: 'get',
        url: 'https://rahasya.setu.co/ecc/v1/generateKey',
        headers: { }
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));

        console.log(JSON.stringify(response.data.KeyMaterial));
        localStorage.setItem("key",JSON.stringify(response.data.KeyMaterial));
        localStorage.setItem("base64YourNonce",JSON.stringify(response.data.KeyMaterial.Nonce));
        localStorage.setItem("ourPrivateKey",JSON.stringify(response.data.privateKey));
      })
      .catch(function (error) {
        console.log(error);
      });
      
});

app.get("/Fi/request",(req,res)=>{
    const privateKey = fs.readFileSync("./keys/private_key.pem", {
        encoding: "utf8",
      });
      const key = localStorage.getItem("key");
      const consent = '"'+localStorage.getItem("consent");
      const id = localStorage.getItem("consentid");

    var data = JSON.stringify({
        "ver": "1.0",
        "timestamp": dateNow.toISOString(),
        "txnid": uuid.create_UUID(),
        "FIDataRange": {
          "from": "2021-01-11T11:39:57.153Z",
          "to": "2021-06-17T14:25:33.440Z"
        },
        "Consent": {
          "id": JSON.parse(id),
          "digitalSignature": JSON.parse(consent)
        },
        "KeyMaterial": JSON.parse(key)
      });
      let detachedJWS = signature.makeDetachedJWS(privateKey, data);
      
      var config = {
        method: 'post',
        url: 'https://aa-sandbox.setu.co/FI/request',
        headers: { 
          'client_api_key': '1b0a81b0-a783-45be-b99e-8f7f352420ff', 
          'x-jws-signature': detachedJWS, 
          'Content-Type': 'application/json'
        },
        data : data
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));
        localStorage.setItem("sessionid",JSON.stringify(response.data.sessionId));
      })
      .catch(function (error) {
        console.log(error);
      });
      
});

app.get("/Fi/fetch",(req,res)=>{
    const privateKey = fs.readFileSync("./keys/private_key.pem", {
        encoding: "utf8",
    });
    let detachedJWS = signature.makeDetachedJWS(privateKey, "/Fi/fetch");
    const sessionId = localStorage.getItem("sessionid");
    var config = {
        method: 'get',
        url: 'https://aa-sandbox.setu.co/FI/fetch/'+JSON.parse(sessionId),
        headers: { 
          'client_api_key': '1b0a81b0-a783-45be-b99e-8f7f352420ff', 
          'x-jws-signature': 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9,,YBAm34O4_4625KAg_-9-6bb7Q60AMzuRcnLzA4-uHLd9-QdMAgyE86hF0U4vZ9KKiUFghrlU0DCurZyIQT8LUsVjYMlixE508cyQegdUTlRXSgbzpifPlVQH5jMll9Ad35VlHpst9jBQga2-X2Pq5DB9i92IbI4KhSoXiRpbm3FlbGxXRFc8Co2ZHwUO4CklCLIuWLNN-DlVVROoNa2Dc04qvUaz1kXA4qxzwXivEt7sfPbGD30Cw-qEBYd5X2lRqnZklq8hlfVIvPgN72HfuOGBtjNa-1mrrSdEUVgYbZ8WAOd6wh8AZ4dctQvLV6EblclP1VxTBLtcWBzRewJK0Q'
        }
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));
        console.log(JSON.stringify(response.data.FI[0].KeyMaterial));
        localStorage.setItem("remoteKeyMaterial",JSON.stringify(response.data.FI[0].KeyMaterial));
        console.log(JSON.stringify(response.data.FI[0].KeyMaterial.Nonce));
        localStorage.setItem("base64RemoteNonce",JSON.stringify(response.data.FI[0].KeyMaterial.Nonce));
        console.log(JSON.stringify(response.data.FI[0].data[0].encryptedFI));
        localStorage.setItem("base64Data",JSON.stringify(response.data.FI[0].data[0].encryptedFI));
      })
      .catch(function (error) {
        console.log(error);
      });

});

app.get("/decrypt",(req,res) =>{
    const base64Data = localStorage.getItem("base64Data");
    const base64RemoteNonce = localStorage.getItem("base64RemoteNonce");
    const base64YourNonce = localStorage.getItem("base64YourNonce");
    const ourPrivateKey = localStorage.getItem("ourPrivateKey");
    const remoteKeyMaterial = localStorage.getItem("remoteKeyMaterial");
    var data = JSON.stringify({
        "base64Data": JSON.parse(base64Data),
        "base64RemoteNonce": JSON.parse(base64RemoteNonce),
        "base64YourNonce": JSON.parse(base64YourNonce),
        "ourPrivateKey": JSON.parse(ourPrivateKey),
        "remoteKeyMaterial": JSON.parse(remoteKeyMaterial)
      });
      
      var config = {
        method: 'post',
        url: 'https://rahasya.setu.co/ecc/v1/decrypt',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : data
      };
      
      axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        res.send(JSON.stringify(response.data));
      })
      .catch(function (error) {
        console.log(error);
      });
})



app.listen(process.env.PORT || 5000, () => console.log("Server is running..."));