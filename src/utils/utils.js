const fs = require('fs-extra');
const { once } = require('events');
const path = require('path');

//--Создание директорий --//
async function addDirectory(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) {
      await fs.mkdirSync(folderPath, { recursive: true });
    }
  } catch (err) {
    console.error(err);
  }
}

//--Запись текста в файл --//
async function writingToFile(nameBase, text) {
  fs.appendFile(nameBase, `${text}\n`, (err) => {
    if (err) throw err;
  });
}

async function getLinesAndRewriteFile(originalFilePath, numLines = 1) {
  let tempFilePath = path.join(
    path.dirname(originalFilePath),
    'temp_' + path.basename(originalFilePath),
  );

  // Создаем поток для чтения
  const readStream = fs.createReadStream(originalFilePath, {
    encoding: 'utf-8',
  });
  const writeStream = fs.createWriteStream(tempFilePath, { encoding: 'utf-8' });

  let lines = [];
  let isFirstLines = true;

  readStream.on('data', function (chunk) {
    readStream.pause(); // Приостанавливаем чтение

    if (isFirstLines) {
      const chunkLines = chunk.split('\n');
      if (lines.length + chunkLines.length >= numLines) {
        const remainingLines = numLines - lines.length;
        lines = lines.concat(chunkLines.slice(0, remainingLines));
        // Записываем оставшиеся данные обратно, исключая первые строки
        writeStream.write(chunkLines.slice(remainingLines).join('\n'));
        isFirstLines = false;
      } else {
        lines = lines.concat(chunkLines);
      }
      readStream.resume(); // Возобновляем чтение
    } else {
      writeStream.write(chunk);
      readStream.resume(); // Возобновляем чтение
    }
  });

  readStream.on('end', function () {
    writeStream.end(); // Закрываем поток записи
  });

  await once(writeStream, 'finish'); // Ожидаем завершения записи

  // Переименовываем временный файл обратно в исходный, заменяя его
  fs.renameSync(tempFilePath, originalFilePath);

  if (lines.length === 0) {
    return null;
  }

  if (numLines === 1) {
    return lines[0];
  }

  return lines.slice(0, numLines);
}

function countLines(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const readStream = fs.createReadStream(filePath, {
      encoding: 'utf-8',
    });

    readStream.on('data', (chunk) => {
      // Подсчитываем количество строк в текущем фрагменте
      lineCount += chunk.split('\n').length;
    });

    readStream.on('end', () => {
      // Когда чтение файла завершено, возвращаем количество строк
      resolve(lineCount);
    });

    readStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function getLinesFile(originalFilePath) {
  const readStream = fs.createReadStream(originalFilePath, {
    encoding: 'utf-8',
  });

  let lines = [];

  readStream.on('data', function (chunk) {
    const chunkLines = chunk.split(/[\r\n]+/g); // Используем регулярное выражение для разделения строк
    lines.push(...chunkLines);
  });

  await once(readStream, 'end');

  const cleanedLines = lines.map((line) => line.trim());

  return cleanedLines.filter((line) => line !== ''); // фильтрация пустых строк
}

//-- Метод проверки отображается ли элемент --//
const isElementVisible = async (page, selector) => {
  let visible = true;
  const el = await page.$(selector);
  if (!el) {
    visible = false;
  }
  return visible;
};

//-- Метод проверки отображается ли элементы --//
const areElementsVisible = async (page, selectors) => {
  const visibleSelectors = [];
  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element) {
      visibleSelectors.push(selector);
      element.dispose();
    }
  }
  return visibleSelectors;
};

async function cleanString(input) {
  // Удаляем все символы, кроме цифр, десятичных точек и пробелов
  const cleaned = input.replace(/[^\d.,\s]/g, '');
  // Заменяем запятые на точки для единообразия формата
  const formatted = cleaned.replace(/,/g, '.');
  // Возвращаем результат
  return formatted;
}

async function shuffle(arr) {
  var j, temp;
  for (let i = arr.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    temp = arr[j];
    arr[j] = arr[i];
    arr[i] = temp;
  }
  return arr;
}

module.exports = {
  addDirectory,
  writingToFile,
  getLinesAndRewriteFile,
  countLines,
  getLinesFile,
  isElementVisible,
  cleanString,
  areElementsVisible,
  shuffle,
};
