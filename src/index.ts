import algosdk from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";
import { SMART_CONTRACT_ARC_32 } from "./client.js";
import { AppSpec } from "@algorandfoundation/algokit-utils/types/app-spec";

// The app ID to interact with.
const appId = 736014374;

// My Address: G5YFEC2BD3BXZJ3OEM4E5SXTFPLXUO3FUS667MY6TSM2XAYNNHALHZ623U

async function loadClient() {
  const algodClient = algokit.getAlgoClient({
    server: "https://testnet-api.algonode.cloud",
    port: 443,
  });
  const indexerClient = algokit.getAlgoIndexerClient({
    server: "https://testnet-idx.algonode.cloud",
    port: 443,
  });
  return { algod: algodClient, indexer: indexerClient };
}

async function main() {
  try {
    // Loading Algorand client
    const client = await loadClient();

    const mnemonic =
      "";
    const account = algosdk.mnemonicToSecretKey(mnemonic);

    // Instantiate the ApplicationClient with getAppClientById
    const appClient = algokit.getAppClientById(
      {
        id: appId,
        app: SMART_CONTRACT_ARC_32 as AppSpec, // Cast to AppSpec
        sender: {
          addr: account.addr,
          signer: algosdk.makeBasicAccountTransactionSigner(account),
        },
      },
      client.algod
    );

    // Step 1: Fetch the ASA ID from the global state
    const globalState = await appClient.getGlobalState();
    const assetId = globalState.asset ? Number(globalState.asset.value) : null;
    if (!assetId) {
      throw new Error(
        "Asset ID not found or invalid in global state under key 'asset'"
      );
    }
    console.log(`Asset ID from global state: ${assetId}`);

    // Step 2: Opt into the ASA if not already opted in
    const accountInfo = await client.algod.accountInformation(account.addr).do();
    const optedIn = accountInfo.assets?.some(
      (asset: { [x: string]: number }) => asset["asset-id"] === assetId
    );
    if (!optedIn) {
      console.log(`Opting into ASA ${assetId}...`);
      const optInTx =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: account.addr,
          to: account.addr,
          assetIndex: assetId,
          amount: 0,
          suggestedParams: await client.algod.getTransactionParams().do(),
        });
      const signedTx = optInTx.signTxn(account.sk);
      const { txId } = await client.algod.sendRawTransaction(signedTx).do();
      await algokit.waitForConfirmation(txId, 4, client.algod);
      console.log(`Opted into ASA ${assetId} with txID: ${txId}`);
    } else {
      console.log(`Already opted into ASA ${assetId}`);
    }

    // Step 3: Call the 'claimAsset' method with a minimum fee of 6000 microAlgos
    console.log("Calling claimAsset method...");
    try {
        const result = await appClient.call({
            method: "claimAsset",
            methodArgs: [], // Add this for ABI call
            sender: { addr: account.addr, signer: algosdk.makeBasicAccountTransactionSigner(account) },
            sendParams: { fee: algokit.microAlgos(6000) },
          });
        console.log(
          `claimAsset transaction successful with txID: ${result.transaction.txID}`
        );
    } catch (e) {
        console.error("Failed to call claimAsset", e);
        throw e; // re-throw so the outer catch block can handle it
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
