// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require("firebase-functions");
const { WebhookClient } = require("dialogflow-fulfillment");

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log("Request headers: " + JSON.stringify(request.headers));
  console.log("Request body: " + JSON.stringify(request.body));

  // An action is a string used to identify what needs to be done in fulfillment
  let action = request.body.queryResult.action; // https://dialogflow.com/docs/actions-and-parameters
  console.log("Actions = " + JSON.stringify(action));

  // let query = request.body.queryResult.resolvedQuery;

  // Parameters are any entites that Dialogflow has extracted from the request.
  const parameters = request.body.queryResult.parameters; // https://dialogflow.com/docs/actions-and-parameters

  // Contexts are objects used to track and store conversation state
  // const inputContexts = request.body.queryResult.contexts; // https://dialogflow.com/docs/contexts

  if (action === "firebase.saveJobOffer") {
    const jobOffer = extractJobOfferData(agent.context);
    console.log("jobOffer", jobOffer);
    if (verifyJobOffer(jobOffer)) {
      saveJobOffer(jobOffer);
    } else {
      sendResponse("Aww 😕. Something weird happened. But don't worry, I've let my human know.");
    }
  }

  function extractJobOfferData(data) {
    const context = data.get("job_offer");
    console.log("context", context);
    const params = context.parameters;

    // Get Name
    const commonName = params["given_name"];
    const unusualName = params["name"];
    const name = commonName ? commonName : unusualName;

    // Get Email
    const email = params["email"];

    // Get Company Name
    const companyName = params["company_name"];

    // Get Company Works For
    const worksForCompany = params["company_works_for"];

    // Get Position Title
    const positionTitle = params["position_title"];

    // Get Position Description
    const positionDescription = params["position_description"];

    // Get Position Type
    const positionType = params["position_type"];

    // Get Contract Details
    const contractHourlyRate = params["hourly_rate"];
    const contractTerm = params["contract_term"];

    // Get Permanent Details
    const annualSalary = params["annual_salary"];

    // Get Renumeration
    const renumeration = {
      amount: undefined,
      currency: "ZAR",
      unit: undefined,
    };
    if (positionType === "permanent") {
      renumeration.amount = annualSalary;
      renumeration.unit = "yearly";
    } else if (positionType === "contract") {
      renumeration.amount = contractHourlyRate;
      renumeration.unit = "hourly";
    }

    return {
      timestamp: admin.database.ServerValue.TIMESTAMP,
      headHunter: {
        name: name,
        email: email,
        worksForCompany: worksForCompany,
      },
      company: {
        name: companyName,
      },
      position: {
        title: positionTitle,
        description: positionDescription,
        type: positionType,
        term: positionType === "contract" ? contractTerm : "N/A",
        renumeration: renumeration,
      },
    };
  }

  function verifyJobOffer(jobOffer) {
    if (!jobOffer) return false;

    return true;
  }

  function saveJobOffer(jobOffer) {
    admin
      .firestore()
      .collection("job-offers")
      .add(jobOffer)
      .then(snapshot => {
        sendResponse(
          "Awesome! I've bundled everything up and sent it my Human. If he likes what he sees he'll contact you. 👍🏽"
        );
        return snapshot;
      })
      .catch(err => {
        console.log(err);
      });
  }

  // Function to send correctly formatted responses to Dialogflow which are then sent to the user
  function sendResponse(responseToUser) {
    // if the response is a string send it as a response to the user
    if (typeof responseToUser === "string") {
      let responseJson = {};
      responseJson.fulfillmentText = responseToUser;
      response.json(responseJson); // Send response to Dialogflow
    } else {
      // If the response to the user includes rich responses or contexts send them to Dialogflow
      let responseJson = {};

      // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
      responseJson.speech = responseToUser.speech || responseToUser.displayText;
      responseJson.displayText = responseToUser.displayText || responseToUser.speech;

      // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
      responseJson.data = responseToUser.richResponses;

      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      responseJson.contextOut = responseToUser.outputContexts;

      response.json(responseJson); // Send response to Dialogflow
    }
  }
});
