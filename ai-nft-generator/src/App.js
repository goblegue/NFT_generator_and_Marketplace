import { useState, useEffect } from "react";

import { Buffer } from "buffer";
import { ethers } from "ethers";
import axios from "axios";

// Components
import Spinner from "react-bootstrap/Spinner";
import Navigation from "./components/Navigation";


// ABIs
import NFT from "./abis/NFT.json";

// Config
import config from "./config.json";

// Utils

import createGroup from "./utils/CreateGroup.js";

function App() {
  // const PINATA_API_KEY = process.env.REACT_APP_PINATA_API_KEY;
  // const PINATA_SECRET_API_KEY = process.env.REACT_APP_PINATA_SECRET_API_KEY;
  const PINATA_JWT = process.env.REACT_APP_PINATA_JWT;

  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [NFTContract, setNFTContract] = useState(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [groupData, setGroupData] = useState(null);
  const [image, setImage] = useState(null);

  const [isWaiting, setWaiting] = useState(false);
  const [message, setMessage] = useState("");
  
  
  

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);
    
    const network = await provider.getNetwork();
    const nft = await new ethers.Contract(config[network.chainId].nft.address, NFT, provider);
     setNFTContract(nft)

  };


  const submitHandler = async (e) => {
    e.preventDefault();

    if(name===""||description===""){
      window.alert("Please provide name and description")
      return;
    }
    try {
      setWaiting(true);
      const imageData = await createImage();
      const NFTMetaDataCID = await uploadNFTMetaData(imageData, name,description);

      // Set the IPFS URL
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${(NFTMetaDataCID)}`;
      console.log("Image uploaded to IPFS:", ipfsUrl);
      setUrl(ipfsUrl);

      // Mint NFT
      const tokenURI = `ipfs://${NFTMetaDataCID}`;
      await mintNFT(tokenURI);
      console.log("NFT Minted:", tokenURI);

      setWaiting(false);
      setMessage("");
    } catch (error) {
      console.error("Error in submit handler:", error);
    }
  };

  const createImage = async () => {
    setMessage("Generating Image...");

    // You can replace this with different model API's
    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-3-medium-diffusers`;

    // Send the request
    const response = await axios({
      url: URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        inputs: description,
        options: { wait_for_model: true },
      }),
      responseType: "arraybuffer",
    });

    const type = response.headers["content-type"];
    const data = response.data;

    const base64data = Buffer.from(data).toString("base64");
    const img = `data:${type};base64,` + base64data;
    setImage(img);

    return img;
  };

  const uploadImageToIPFS = async (imageData, name) => {
    setMessage("Uploading to IPFS...");

    try {
      // Convert base64 image to blob
      const blob = await fetch(imageData).then((res) => res.blob());

      // Create form data
      const formData = new FormData();
      formData.append("file", blob, "image.png");

      // Prepare metadata
      const metadata = JSON.stringify({
        name: name,
      });
      formData.append("pinataMetadata", metadata);
      
      // Pinata API endpoint
      const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

      // Send request to Pinata
      const response = await axios.post(url, formData, {
        maxBodyLength: "Infinity",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
          Authorization: `Bearer ${process.env.REACT_APP_PINATA_JWT}`,
        },
      });


      return response.data.IpfsHash;
    } catch (error) {
      console.error("Error uploading to IPFS:", error);
      throw error;
    }
  };

  const uploadNFTMetaData = async (imageData, name, description) =>{
    const imageCID = await uploadImageToIPFS(imageData, name);

    const jsonData = JSON.stringify({
      pinataContent: {
        name: name,
        description: description,
        image: `ipfs://${imageCID}`,
        external_url: `https://pinata.cloud`,
      },
       pinataMetadata:{
        name: name,
       },
       pinataOptions:{
        groupId: groupData.id
       }
      }
  );
  try {
    const uploadRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      jsonData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );


    return(uploadRes.data.IpfsHash);
  } catch (error) {
    console.error(error);
  }

  }

  const mintNFT = async (tokenURI) => {
    setMessage("Minting NFT...");
    const signer = await provider.getSigner();
    const transaction = await NFTContract.connect(signer).mint(tokenURI,{value: ethers.utils.parseUnits("0.1","ether")});
    await transaction.wait();
  }

  useEffect(() => {
    const init = async () => {
      await loadBlockchainData();

      const groupData = await createGroup(); // Execute the script at startup and get group data
      setGroupData(groupData); // Store the group Data
    };
    init();
  }, []);

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <div className="form">
        <form onSubmit={submitHandler}>
          <input
            type="text"
            placeholder="Create a name..."
            onChange={(e) => {
              setName(e.target.value);
            }}
          ></input>
          <input
            type="text"
            placeholder="Create a description..."
            onChange={(e) => {
              setDescription(e.target.value);
            }}
          ></input>
          <input type="submit" placeholder="Create & Mint"></input>
        </form>
        <div className="image">
          {!isWaiting && image ?(
            <img src={image} alt="Ai Generated Image" />
          ): isWaiting ?(
            <div className="image__placeholder">
              <Spinner animation="border"/>
              <p>{message}</p>
            </div>
          ): (
            <></>
          )}
          

        </div>
      </div>
      {!isWaiting && url &&(
      <p>
        View&nbsp;
        <a href={url} target="_blank" rel="noreferrer">
          Metadata
        </a>
      </p>)}
    </div>
  );
}

export default App;
