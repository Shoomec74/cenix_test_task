const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const { shuffle, getLinesFile } = require('./src/utils/utils');

const BASE_PATH = path.join(__dirname, 'src', 'base');
const REGION_PATH = path.join(BASE_PATH, 'base_cities.txt');
const URL_PATH = path.join(BASE_PATH, 'base_products.txt');

// Асинхронная функция для запуска команды
async function runCommand(command) {
  try {
    const { stdout, stderr } = await exec(command);
    console.log(`stdout: ${stdout}`);
    if (stderr) {
      console.log(`stderr: ${stderr}`);
    }
  } catch (error) {
    console.error(`exec error: ${error}`);
  }
}

(async () => {
  // Чтение регионов и URL из файлов
  const regions = await getLinesFile(REGION_PATH);
  const urls = await getLinesFile(URL_PATH);

  for await (const region of regions) {
    const randArr = await shuffle(urls);
    for await (const url of randArr) {
      const command = `npm run start parse "${url}" "${region}"`;
      console.log(`Executing: ${command}`);
      await runCommand(command);
    }
  }
})().catch((e) => console.error(e));
