import algosdk from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";
import { SMART_CONTRACT_ARC_32 } from "./client";

// The app ID to interact with.
const appId = 736014374;

// My Address: G5YFEC2BD3BXZJ3OEM4E5SXTFPLXUO3FUS667MY6TSM2XAYNNHALHZ623U

async function loadClient() {
  const client = algokit.AlgorandClient.fromConfig({
    algodConfig: {
      server: "https://testnet-api.algonode.cloud",
    },
    indexerConfig: {
      server: "https://testnet-idx.algonode.cloud",
    },
  });
  return client;
}

async function main() {
  try {
    // Loading Algorand client
    const client = await loadClient();

    const mnemonic = "your 25-word mnemonic here";
    const account = algosdk.mnemonicToSecretKey(mnemonic);

    // Instantiate the ApplicationClient using the ARC-32 spec
    const appClient = client.appClient({
      app: SMART_CONTRACT_ARC_32,
      id: appId,
      sender: account,
    });

    // Step 1: Fetch the ASA ID from the global state
    const globalState = await appClient.getGlobalState();
    // 'asset' key holds the ASA ID
    const assetId = Number(globalState.asset.asBigInt()); 
    if (!assetId) {
      throw new Error("Asset ID not found in global state under key 'asset'");
    }
    console.log(`Asset ID from global state: ${assetId}`);

    // Step 2: Opt into the ASA if not already opted in
    const accountInfo = await client.account.getInformation(account.addr);
    const optedIn = accountInfo.assets?.some((asset) => asset.assetId === assetId);
    if (!optedIn) {
      console.log(`Opting into ASA ${assetId}...`);
      const optInResult = await client.send.assetOptIn({
        assetId,
        sender: account,
      });
      await algokit.waitForConfirmation(optInResult.txId, client.algod);
      console.log(`Opted into ASA ${assetId} with txID: ${optInResult.txId}`);
    } else {
      console.log(`Already opted into ASA ${assetId}`);
    }

    // Step 3: Call the 'claimAsset' method with a minimum fee of 6000 microAlgos
    console.log("Calling claimAsset method...");
    const suggestedParams = await client.algod.getTransactionParams().do();
    const result = await appClient.call({
      method: "claimAsset",
      methodArgs: [],
      sender: account,
      sendParams: {
        suggestedParams: {
          ...suggestedParams,
          fee: 6000, // Set minimum fee to 6000 microAlgos
          flatFee: true, // Ensure fee is exact
        },
      },
    });
    console.log(`claimAsset transaction successful with txID: ${result.confirmation?.txn.txn.txID}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();