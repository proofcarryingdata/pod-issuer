// Default POD template.
const defaultPODTemplate = `{
      "zupass_display": "collectable",
      "zupass_image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Felis_catus-cat_on_snow.jpg/358px-Felis_catus-cat_on_snow.jpg",
      "zupass_title": "friendly kitty",
      "zupass_description": "friendly kitty says hello"
}`;
document.getElementById("podJSON").innerHTML = defaultPODTemplate;

// QR code SVG. Include logo if present.
const includeLogoSVG = await fetch("logo.svg").then((req) =>
  req.status !== 404
);
const qrCodeSVG = (podId) =>
  `<qr-code id="pod:${podId}" style="width: 512px; height: 512px;" contents="${window.location.origin}/api/getMintLink/${podId}">${
    includeLogoSVG ? '<img src="logo.svg" slot="icon">' : ""
  }</qr-code>`;

// Auxiliary function for forming entry of list of mintable PODs
const makeMintablePODHTMLEntry = (podName, podDescription, podId) =>
  `<p id="mintablePOD:${podId}">${qrCodeSVG(podId)}<a href="${
    mintLinkFromId(podId)
  }">${podName}</a>   - <button type="button" id="removePOD:${podId}">Remove</button><br>
      <small><i>${podDescription}</i></small></p>`;

// Mintable POD renderer.
function renderMintablePODs() {
  document.getElementById("mintablePODs").innerHTML = Object.entries(
    mintablePODs,
  ).map(([podId, { podName, podDescription }]) =>
    makeMintablePODHTMLEntry(podName, podDescription, podId)
  )
    .reduce((acc, curStr) => curStr + acc, "");
  Object.entries(mintablePODs).forEach(([podId, _]) =>
    document.getElementById(`removePOD:${podId}`).addEventListener(
      "click",
      () => removeMintablePOD(podId),
    )
  );
}

// Local list of mintable PODs.
const mintablePODs = await getMintablePODs();
renderMintablePODs();

// Get mintable PODs.
await getMintablePODs();

// Form containing POD template.
const form = document.querySelector("#podEntries");

// Short(er) mint link from POD content ID.
function mintLinkFromId(podId) {
  return `/api/getMintLink/${podId}`;
}

// Mintable POD fetcher.
async function getMintablePODs() {
  try {
    const response = await fetch("/api/getMintablePODs", {
      method: "GET",
    });

    const mintablePODs = await response.json();

    return mintablePODs;
  } catch (e) {
    document.getElementById("mintablePODs").innerHTML = String(e);
  }
}

// Procedure for adding PODs to the store.
async function addPOD() {
  const formData = new FormData(form);
  try {
    // POD entries should be valid JSON.
    const podEntriesJSON = formData.get("podJSON");
    const podEntries = JSON.parse(podEntriesJSON);
    const signerPrivateKey = formData.get("signerPrivateKey");
    const podFolder = formData.get("podFolder");
    const response = await fetch("/api/addMintablePOD", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        podEntries: podEntriesJSON,
        signerPrivateKey,
        podFolder,
      }),
    });

    // Indicate success/failure below.
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const wrappedPODId = await response.json();
    const podId = wrappedPODId.podId;

    const mintUrl = mintLinkFromId(podId);
    document.getElementById("currentMint").innerHTML =
      `<a href="${mintUrl}">Mint link</a><br>${qrCodeSVG(podId)}`;

    // Push onto list of mintable PODs and re-render.
    mintablePODs[podId] = {
      podName: podEntries.zupass_title,
      podDescription: podEntries.zupass_description,
    };
    renderMintablePODs();
  } catch (e) {
    document.getElementById("currentMint").innerHTML = String(e);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  addPOD();
});

async function removeMintablePOD(podId) {
  const response = await fetch(`/api/removeMintablePOD/${podId}`);
  if (response.ok) {
    document.getElementById(`mintablePOD:${podId}`).remove();
  } else {
    console.error(response.text());
  }
}
