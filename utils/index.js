const askQuestion = async (readline, question) => {
  return await readline.questionAsync(question);
};

const readFile = async (readline, fs) => {
  try {
    const filePath = await askQuestion(
      readline,
      "Enter the full path of the file to upload: "
    );
    const replaceBy = process.platform === "win32" ? "/" : "";
    const nameWithoutSpaces = filePath.replace(/\\/g, replaceBy);
    const fileName = nameWithoutSpaces.split("/").pop();
    const fileContent = await fs.readFile(nameWithoutSpaces);
    return { fileContent, fileName };
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }
};

const buildTree = (arr) => {
  const tree = [];
  const treeMap = {};

  arr.forEach((item) => {
    const keys = item.Key.split("/");
    let currentLevel = tree;
    let currentPath = "";

    keys.forEach((key, index) => {
      currentPath += currentPath === "" ? key : `/${key}`;

      if (!treeMap[currentPath]) {
        const newNode = { Key: currentPath };
        currentLevel.push(newNode);
        treeMap[currentPath] = newNode;

        if (index === keys.length - 1) {
          // If it's the last segment, add the file details
          newNode.details = item;
        } else {
          // If it's not the last segment, it's a folder
          newNode.children = [];
        }
      }

      currentLevel = treeMap[currentPath].children;
    });
  });

  return tree;
};

module.exports = {
  askQuestion,
  readFile,
  buildTree,
};
