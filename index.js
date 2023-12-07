const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListObjectsCommand,
} = require("@aws-sdk/client-s3");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const readline = require("readline-promise").default.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});
const { askQuestion, readFile, buildTree } = require("./utils");
const { arrayOfUnits } = require("./constants");

require("dotenv").config();

const createS3Client = () => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`, // Cloudflare R2 endpoint URL
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
  });
};

const createBucket = async (s3, bucketName) => {
  console.log(`Creating bucket ${bucketName}`);
  const command = new CreateBucketCommand({ Bucket: bucketName });
  try {
    const { Location } = await s3.send(command);
    console.log(`Bucket ${bucketName} created with location ${Location}`);
  } catch (error) {
    if (error.name === "BucketAlreadyOwnedByYou") {
      console.log(`Bucket ${bucketName} already exists, skipping...`);
    } else {
      console.error(`Error creating bucket ${bucketName}`, error);
    }
  }
};

const uploadFile = async (s3, bucketName, fileName, fileContent) => {
  console.log(`\nUploading file ${fileName} to bucket ${bucketName}`);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: fileContent,
    ContentType: "video/mp4",
  });

  try {
    await s3.send(command);
  } catch (error) {
    console.error(
      `Error uploading file ${fileName} to bucket ${bucketName}`,
      error
    );
  }
};

const readFilesFromBucket = async (s3, bucketName) => {
  console.log(`\nReading files from bucket ${bucketName}`);
  let result = [];

  for (let i = 0; i < arrayOfUnits.length; i++) {
    const command = new ListObjectsCommand({
      Bucket: bucketName,
      Prefix: arrayOfUnits[i],
    });
    if (!command) return;
    try {
      const { Contents } = await s3.send(command);
      if (Contents?.length) {
        Contents?.forEach((file) => {
          const nameWithoutSpaces = file.Key.replace(/\s/g, "%20");
          file.url = `${process.env.BUCKET_PUBLIC_URL}${nameWithoutSpaces}`;
        });
        result = [...result, ...Contents];
      }
    } catch (error) {
      console.error(`Error reading files from bucket ${bucketName}`, error);
    }
  }

  const results = buildTree(result);

  const sortedResult = results.sort((a, b) => {
    const numA = parseInt(a.Key.match(/\d+/)[0], 10);
    const numB = parseInt(b.Key.match(/\d+/)[0], 10);
    return numA - numB;
  });

  console.log(`\nFiles in bucket:`, sortedResult.length);
  console.log(`\nUploading to API...`);

  const response = await fetch(process.env.API_URL, {
    method: "POST",
    body: JSON.stringify({ value: sortedResult }),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.API_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  await fs.writeFile(
    `${bucketName}-content.json`,
    JSON.stringify(sortedResult, null, 2),
    "utf8"
  );

  console.log(`\nFiles list saved to ./${bucketName}-content.json`);
  console.log(`\nUpload to API success!`);
};

const main = async () => {
  const bucketName = process.env.BUCKET_NAME;
  const options = ["Read docs", "Upload file", "Create bucket"];

  try {
    const s3 = createS3Client();
    const index = await askQuestion(
      readline,
      "What do you want to do?\n" +
        options.map((opt, i) => `${i + 1}. ${opt}`).join("\n") +
        "\n\n" +
        "> "
    );

    if (index === "1") {
      await readFilesFromBucket(s3, bucketName);
      return;
    }

    if (index === "2") {
      console.log("\nUPLOAD FILE\n");
      const r2Path = await askQuestion(readline, "Enter R2 path: ");
      const { fileContent, fileName } = await readFile(readline, fs);
      const name = r2Path + fileName;
      await uploadFile(s3, bucketName, name, fileContent);
      const nameWithoutSpaces = name.replace(/\s/g, "%20");
      console.log(
        "\n[File URL]:",
        `${process.env.BUCKET_PUBLIC_URL}${nameWithoutSpaces}`
      );
      return;
    }

    if (index === "3") {
      await createBucket(s3, bucketName);
      return;
    }
    console.log("\nInvalid option");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    readline.close();
  }
};

module.exports = {
  createBucket,
  uploadFile,
  readFilesFromBucket,
  main,
};

if (require.main === module) {
  main().catch(console.error);
}
