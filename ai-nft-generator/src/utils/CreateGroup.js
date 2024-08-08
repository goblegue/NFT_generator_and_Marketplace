import  axios from 'axios';

const createGroup = async () => {
  const PINATA_JWT = process.env.REACT_APP_PINATA_JWT;

  const groupData = {
    name: "AI NFT Collection",
  };

  try {
    const createGroupRes = await axios.post(
      "https://api.pinata.cloud/groups",
      groupData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
      }
    );

    return(createGroupRes.data);
  } catch (error) {
    console.error(error);
  }
};

export default createGroup;



