// NameResolver v3.4 — увеличен вес популярности отчеств

const NameResolver = {
  id: "name-resolver",
  name: "Распознаватель ФИО",
  version: "3.4",
  description: "Превращает сокращения в полные ФИО с определением пола",
  syntax: "Поставьте курсор на строку с сокращениями и нажмите кнопку",
  
  toolbarButton: {
    text: "📝 Распознать ФИО",
    title: "Превратить сокращения в полные ФИО (Ctrl+Shift+R)",
    onClick: function(api) { resolveFIO(api); }
  },
  
  init: function(api) { api.registerHotkey("Ctrl+Shift+R", function() { resolveFIO(api); }); },
  process: function(text, cursorPos, api) { return { text, cursorPos }; }
};

// ========== ИМЕНА (нормализованные веса 0-100) ==========
var maleNames = [
  "Александр:100", "Владимир:88", "Сергей:85", "Николай:82", "Алексей:78",
  "Андрей:72", "Дмитрий:68", "Виктор:65", "Михаил:60", "Иван:58",
  "Евгений:55", "Юрий:52", "Анатолий:50", "Валерий:45", "Павел:42",
  "Игорь:40", "Олег:38", "Борис:35", "Василий:33", "Геннадий:30",
  "Владислав:28", "Вячеслав:26", "Константин:25", "Виталий:23", "Станислав:21",
  "Роман:20", "Денис:18", "Антон:17", "Илья:16", "Кирилл:15",
  "Максим:14", "Артём:13", "Егор:12", "Никита:11", "Даниил:10",
  "Марк:9", "Матвей:8", "Тимофей:7", "Руслан:6", "Ярослав:5",
  "Арсений:4", "Лев:4", "Степан:4", "Тимур:3", "Фёдор:3",
  "Глеб:3", "Богдан:2", "Марат:2", "Филипп:2", "Валентин:2",
  "Игнат:1", "Эдуард:1", "Аркадий:1"
];

var femaleNames = [
  "Елена:100", "Татьяна:95", "Наталья:90", "Ольга:85", "Ирина:82",
  "Светлана:78", "Мария:75", "Анна:72", "Людмила:70", "Галина:65",
  "Валентина:62", "Екатерина:58", "Надежда:55", "Вера:52", "Виктория:48",
  "Александра:45", "Юлия:42", "Лариса:40", "Нина:38", "Тамара:36",
  "Алла:34", "Зоя:32", "Раиса:30", "Римма:28", "Лидия:26",
  "Регина:24", "Ксения:22", "Диана:20", "Ульяна:18", "Яна:16",
  "Карина:15", "Лилия:14", "Оксана:13", "Алёна:12", "Алиса:11",
  "Полина:10", "Елизавета:9", "Анастасия:8", "София:7", "Софья:6",
  "Дарья:5", "Алина:4", "Вероника:3.5", "Евгения:3", "Маргарита:2.5",
  "Валерия:35"
];

// ========== ОТЧЕСТВА ==========
var patronymicList = [
  "александров:100", "иванов:95", "петров:90", "семёнов:85", "васильев:80",
  "владимиров:78", "сергеев:75", "дмитриев:72", "николаев:70", "михайлов:65",
  "андреев:60", "алексеев:55", "павлов:50", "борисов:48", "фёдоров:46",
  "георгиев:44", "игорев:42", "кириллов:40", "леонидов:38", "максимов:36",
  "романов:34", "степанов:32", "тимофеев:30", "юрьев:28", "захаров:26",
  "матвеев:24", "арсеньев:22", "викторов:20", "владиславов:18", "вячеславов:17",
  "даниилов:16", "денисов:15", "евгеньев:14", "егоров:13", "валерьев:11",
  "вадимов:10", "витальев:9", "константинов:8", "львов:7", "русланов:6",
  "тимуров:5", "ярославов:4", "адамов:3", "альбертов:2.5", "амиров:2",
  "всеволодов:1.5", "гавриилов:1", "герасимов:0.8", "германов:0.5", "гордеев:0.4",
  "дамиров:0.3", "демидов:0.2", "демьянов:0.15", "иосифов:0.1", "казимиров:0.08",
  "платонов:0.06", "прохоров:0.04", "родионов:0.03", "святославов:0.02", "тихонов:0.015",
  "филиппов:0.01", "эдуардов:0.005", "юлианов:0.003",
  // Исключения
  "ильи:12:ч:нична", "никити:10:ч:чна"
];

// Преобразование списков
var maleNamesList = [];
var femaleNamesList = [];
var patronymicRoots = {};

function buildLists() {
  for (var i = 0; i < maleNames.length; i++) {
    var parts = maleNames[i].split(':');
    maleNamesList.push({ name: parts[0], popularity: parseFloat(parts[1]) });
  }
  for (var i = 0; i < femaleNames.length; i++) {
    var parts = femaleNames[i].split(':');
    femaleNamesList.push({ name: parts[0], popularity: parseFloat(parts[1]) });
  }
  for (var i = 0; i < patronymicList.length; i++) {
    var parts = patronymicList[i].split(':');
    var root = parts[0];
    var rate = parseFloat(parts[1]);
    var maleEnd = parts[2] || "ич";
    var femaleEnd = parts[3] || "на";
    patronymicRoots[root] = { rate: rate, maleEnd: maleEnd, femaleEnd: femaleEnd };
  }
}
buildLists();

// ========== НЕЧЁТКИЙ ПОИСК ==========
function matchesPattern(pattern, fullName) {
  var patternLower = pattern.toLowerCase();
  var nameLower = fullName.toLowerCase();
  var patternPos = 0;
  var namePos = 0;
  
  while (patternPos < patternLower.length && namePos < nameLower.length) {
    if (patternLower[patternPos] === nameLower[namePos]) {
      patternPos++;
      namePos++;
    } else {
      namePos++;
    }
  }
  return patternPos === patternLower.length;
}

function calculateSimilarity(pattern, fullName) {
  var patternLower = pattern.toLowerCase();
  var nameLower = fullName.toLowerCase();
  
  if (!matchesPattern(patternLower, nameLower)) return Infinity;
  
  var positions = [];
  var patternPos = 0;
  var namePos = 0;
  
  while (patternPos < patternLower.length && namePos < nameLower.length) {
    if (patternLower[patternPos] === nameLower[namePos]) {
      positions.push(namePos);
      patternPos++;
      namePos++;
    } else {
      namePos++;
    }
  }
  
  if (patternPos < patternLower.length) return Infinity;
  
  var lengthDiff = Math.abs(fullName.length - pattern.length);
  
  var totalGap = 0;
  for (var i = 1; i < positions.length; i++) {
    totalGap += positions[i] - positions[i-1] - 1;
  }
  var avgGap = positions.length > 1 ? totalGap / (positions.length - 1) : 0;
  var firstCharPenalty = positions[0];
  
  return lengthDiff * 2 + avgGap * 1.5 + firstCharPenalty * 3;
}

function findBestMatchInGender(pattern, gender, debugLog) {
  if (!pattern || pattern.length === 0) return null;
  
  var nameList = (gender === 'м') ? maleNamesList : femaleNamesList;
  var candidates = [];
  
  for (var i = 0; i < nameList.length; i++) {
    var similarity = calculateSimilarity(pattern, nameList[i].name);
    if (similarity !== Infinity) {
      candidates.push({
        name: nameList[i].name,
        gender: gender,
        similarity: similarity,
        popularity: nameList[i].popularity
      });
    }
  }
  
  if (candidates.length === 0) return null;
  
  var minSim = Infinity, maxSim = -Infinity;
  var minPop = Infinity, maxPop = -Infinity;
  
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].similarity < minSim) minSim = candidates[i].similarity;
    if (candidates[i].similarity > maxSim) maxSim = candidates[i].similarity;
    if (candidates[i].popularity < minPop) minPop = candidates[i].popularity;
    if (candidates[i].popularity > maxPop) maxPop = candidates[i].popularity;
  }
  
  var simRange = (maxSim - minSim) || 1;
  var popRange = (maxPop - minPop) || 1;
  
  for (var i = 0; i < candidates.length; i++) {
    var normSim = (candidates[i].similarity - minSim) / simRange;
    var normPop = (maxPop - candidates[i].popularity) / popRange;
    candidates[i].score = normSim * 0.7 + normPop * 0.3;
  }
  
  candidates.sort(function(a, b) { return a.score - b.score; });
  
  if (debugLog) {
    debugLog.push("--- Поиск '" + pattern + "' в " + (gender === 'м' ? 'МУЖСКИХ' : 'ЖЕНСКИХ') + " ---");
    for (var i = 0; i < Math.min(10, candidates.length); i++) {
      debugLog.push("  " + (i+1) + ". " + candidates[i].name + " | sim=" + candidates[i].similarity.toFixed(1) + " | pop=" + candidates[i].popularity + " | score=" + candidates[i].score.toFixed(4));
    }
    if (candidates.length > 10) debugLog.push("  ... и ещё " + (candidates.length - 10) + " кандидатов");
    debugLog.push("  -> ВЫБРАН: " + candidates[0].name + " (score=" + candidates[0].score.toFixed(4) + ")");
  }
  
  return candidates[0];
}

function findBestMatchAnyGender(pattern, debugLog) {
  if (!pattern || pattern.length === 0) return null;
  
  var candidates = [];
  
  for (var i = 0; i < maleNamesList.length; i++) {
    var similarity = calculateSimilarity(pattern, maleNamesList[i].name);
    if (similarity !== Infinity) {
      candidates.push({
        name: maleNamesList[i].name,
        gender: 'м',
        similarity: similarity,
        popularity: maleNamesList[i].popularity
      });
    }
  }
  
  for (var i = 0; i < femaleNamesList.length; i++) {
    var similarity = calculateSimilarity(pattern, femaleNamesList[i].name);
    if (similarity !== Infinity) {
      candidates.push({
        name: femaleNamesList[i].name,
        gender: 'ж',
        similarity: similarity,
        popularity: femaleNamesList[i].popularity
      });
    }
  }
  
  if (candidates.length === 0) return null;
  
  var minSim = Infinity, maxSim = -Infinity;
  var minPop = Infinity, maxPop = -Infinity;
  
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].similarity < minSim) minSim = candidates[i].similarity;
    if (candidates[i].similarity > maxSim) maxSim = candidates[i].similarity;
    if (candidates[i].popularity < minPop) minPop = candidates[i].popularity;
    if (candidates[i].popularity > maxPop) maxPop = candidates[i].popularity;
  }
  
  var simRange = (maxSim - minSim) || 1;
  var popRange = (maxPop - minPop) || 1;
  
  for (var i = 0; i < candidates.length; i++) {
    var normSim = (candidates[i].similarity - minSim) / simRange;
    var normPop = (maxPop - candidates[i].popularity) / popRange;
    candidates[i].score = normSim * 0.7 + normPop * 0.3;
  }
  
  candidates.sort(function(a, b) { return a.score - b.score; });
  
  if (debugLog) {
    debugLog.push("--- Поиск '" + pattern + "' во ВСЕХ именах ---");
    for (var i = 0; i < Math.min(15, candidates.length); i++) {
      var marker = (candidates[i].gender === 'м') ? '♂' : '♀';
      debugLog.push("  " + (i+1) + ". " + marker + " " + candidates[i].name + " | sim=" + candidates[i].similarity.toFixed(1) + " | pop=" + candidates[i].popularity + " | score=" + candidates[i].score.toFixed(4));
    }
    if (candidates.length > 15) debugLog.push("  ... и ещё " + (candidates.length - 15) + " кандидатов");
    debugLog.push("  -> ВЫБРАН: " + candidates[0].name + " (" + (candidates[0].gender === 'м' ? 'мужской' : 'женский') + ", score=" + candidates[0].score.toFixed(4) + ")");
  }
  
  return candidates[0];
}

function detectGenderBySurname(surname) {
  if (!surname || surname.length === 0) return null;
  var lower = surname.toLowerCase();
  
  if (lower.endsWith('ина') || lower.endsWith('ова') || 
      lower.endsWith('ева') || lower.endsWith('ская') ||
      lower.endsWith('а') || lower.endsWith('я')) {
    return 'ж';
  }
  
  if (lower.endsWith('ин') || lower.endsWith('ов') || 
      lower.endsWith('ев') || lower.endsWith('ский') ||
      lower.endsWith('в') || lower.endsWith('н') || 
      lower.endsWith('й') || lower.endsWith('ий') || 
      lower.endsWith('ой')) {
    return 'м';
  }
  
  return null;
}

function getPatronymic(root, gender) {
  var data = patronymicRoots[root];
  if (!data) {
    // fallback: если корень не найден, возвращаем как есть
    return capitalize(root);
  }
  
  var result = root + (gender === 'м' ? data.maleEnd : data.femaleEnd);
  return capitalize(result);
}

// ========== ФУНКЦИЯ findPatronymic ==========
function findPatronymic(pattern, gender, debugLog) {
  if (!pattern) return null;
  var lowerPattern = pattern.toLowerCase();
  
  var candidates = [];
  
  for (var root in patronymicRoots) {
    if (matchesPattern(lowerPattern, root)) {
      var similarity = calculateSimilarity(lowerPattern, root);
      if (similarity !== Infinity) {
        candidates.push({
          root: root,
          similarity: similarity,
          rate: patronymicRoots[root].rate
        });
      }
    }
  }
  
  if (candidates.length === 0) {
    if (debugLog) debugLog.push("Отчество '" + pattern + "' не найдено в базе, оставляем как есть");
    return capitalize(pattern);
  }
  
  var minSim = Infinity, maxSim = -Infinity;
  var minRate = Infinity, maxRate = -Infinity;
  
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i].similarity < minSim) minSim = candidates[i].similarity;
    if (candidates[i].similarity > maxSim) maxSim = candidates[i].similarity;
    if (candidates[i].rate < minRate) minRate = candidates[i].rate;
    if (candidates[i].rate > maxRate) maxRate = candidates[i].rate;
  }
  
  var simRange = (maxSim - minSim) || 1;
  var rateRange = (maxRate - minRate) || 1;
  
  for (var i = 0; i < candidates.length; i++) {
    var normSim = (candidates[i].similarity - minSim) / simRange;
    var normRate = (maxRate - candidates[i].rate) / rateRange;
    // Сходство важнее популярности (0.8 vs 0.2)
    candidates[i].score = normSim * 0.8 + normRate * 0.2;
  }
  
  candidates.sort(function(a, b) { return a.score - b.score; });
  var best = candidates[0];
  
  if (debugLog) {
    debugLog.push("--- Поиск отчества '" + pattern + "' ---");
    for (var i = 0; i < Math.min(5, candidates.length); i++) {
      debugLog.push("  " + (i+1) + ". корень '" + candidates[i].root + "' | sim=" + candidates[i].similarity.toFixed(1) + " | rate=" + candidates[i].rate + " | score=" + candidates[i].score.toFixed(4));
    }
    debugLog.push("  -> ВЫБРАН корень '" + best.root + "' → " + getPatronymic(best.root, gender));
  }
  
  return getPatronymic(best.root, gender);
}

function capitalize(word) {
  if (!word || word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function isCapitalized(word) {
  if (!word || word.length === 0) return false;
  return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
}

function parseLine(line) {
  line = line.trim();
  if (!line) return null;
  
  var words = line.split(/\s+/);
  
  var explicitGender = null;
  var lastWord = words[words.length - 1];
  if (lastWord === 'м' || lastWord === 'ж') {
    explicitGender = lastWord;
    words.pop();
  }
  
  var surname = null;
  var namePattern = null;
  var patronymicPattern = null;
  
  if (words.length === 1) {
    namePattern = words[0];
  } else if (words.length === 2) {
    namePattern = words[0];
    patronymicPattern = words[1];
  } else if (words.length >= 3) {
    surname = words[0];
    namePattern = words[1];
    patronymicPattern = words[2];
  }
  
  return {
    surname: surname,
    namePattern: namePattern,
    patronymicPattern: patronymicPattern,
    explicitGender: explicitGender
  };
}

function determineGender(parsed, nameResult, debugLog) {
  // 1. Явное указание
  if (parsed.explicitGender) {
    if (debugLog) debugLog.push("Пол определён по ЯВНОМУ указанию: " + (parsed.explicitGender === 'м' ? 'мужской' : 'женский'));
    return parsed.explicitGender;
  }
  
  // 2. По фамилии (всегда, регистр не важен)
  if (parsed.surname) {
    var surnameGender = detectGenderBySurname(parsed.surname);
    if (surnameGender) {
      if (debugLog) debugLog.push("Пол определён по ФАМИЛИИ '" + parsed.surname + "': " + (surnameGender === 'м' ? 'мужской' : 'женский') + " (окончание '" + parsed.surname.slice(-3) + "')");
      return surnameGender;
    }
  }
  
  // 3. По имени
  if (nameResult) {
    if (debugLog) debugLog.push("Пол определён по ИМЕНИ '" + nameResult.name + "': " + (nameResult.gender === 'м' ? 'мужской' : 'женский'));
    return nameResult.gender;
  }
  
  if (debugLog) debugLog.push("Пол НЕ ОПРЕДЕЛЁН");
  return null;
}

// ========== ОСНОВНАЯ ФУНКЦИЯ ==========
function resolveFIO(api) {
  var debugLog = ["========== ОТЛАДКА NameResolver =========="];
  
  var text = api.getText();
  var cursorPos = api.getCursor();
  
  var lineStart = cursorPos;
  var lineEnd = cursorPos;
  
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;
  
  var currentLine = text.substring(lineStart, lineEnd);
  
  debugLog.push("Исходная строка: '" + currentLine + "'");
  
  if (!currentLine.trim()) {
    api.showHint('❌ Строка пуста', 2000);
    return;
  }
  
  var parsed = parseLine(currentLine);
  if (!parsed || (!parsed.namePattern && !parsed.surname)) {
    api.showHint('❌ Не удалось распознать структуру строки', 2000);
    return;
  }
  
  debugLog.push("Распознано:");
  debugLog.push("  Фамилия: " + (parsed.surname || '(нет)'));
  debugLog.push("  Имя: " + (parsed.namePattern || '(нет)'));
  debugLog.push("  Отчество: " + (parsed.patronymicPattern || '(нет)'));
  debugLog.push("  Явный пол: " + (parsed.explicitGender || '(нет)'));
  
  // Поиск имени
  var nameResult = null;
  if (parsed.namePattern && !isCapitalized(parsed.namePattern)) {
    if (parsed.explicitGender) {
      nameResult = findBestMatchInGender(parsed.namePattern, parsed.explicitGender, debugLog);
    } else {
      nameResult = findBestMatchAnyGender(parsed.namePattern, debugLog);
    }
  } else if (parsed.namePattern && isCapitalized(parsed.namePattern)) {
    debugLog.push("Имя '" + parsed.namePattern + "' уже с большой буквы, не обрабатываем");
  }
  
  // Определение пола
  var detectedGender = determineGender(parsed, nameResult, debugLog);
  
  // Формирование результата
  var resultParts = [];
  
  if (parsed.surname) resultParts.push(capitalize(parsed.surname));
  
  var finalName = parsed.namePattern;
  if (nameResult) {
    finalName = nameResult.name;
    debugLog.push("Итоговое имя: '" + parsed.namePattern + "' → '" + finalName + "'");
  } else if (parsed.namePattern && !isCapitalized(parsed.namePattern)) {
    finalName = capitalize(parsed.namePattern);
    debugLog.push("Итоговое имя: '" + parsed.namePattern + "' → '" + finalName + "' (простая капитализация)");
  }
  if (finalName) resultParts.push(capitalize(finalName));
  
  // Отчество
  if (parsed.patronymicPattern) {
    var finalPatronymic = null;
    if (detectedGender && !isCapitalized(parsed.patronymicPattern)) {
      finalPatronymic = findPatronymic(parsed.patronymicPattern, detectedGender, debugLog);
    } else {
      finalPatronymic = capitalize(parsed.patronymicPattern);
      debugLog.push("Отчество '" + parsed.patronymicPattern + "' → '" + finalPatronymic + "' (простая капитализация)");
    }
    if (finalPatronymic) resultParts.push(finalPatronymic);
  }
  
  var resultText = resultParts.join(' ');
  debugLog.push("\n========== РЕЗУЛЬТАТ ==========");
  debugLog.push("→ " + resultText);
  
  var genderText = '';
  if (detectedGender === 'м') genderText = ' (мужской)';
  else if (detectedGender === 'ж') genderText = ' (женский)';
  
  // Формируем отладочный блок
  var debugBlock = "\n\n/* ========== ОТЛАДКА NameResolver ==========\n" + debugLog.join("\n") + "\n*/";
  
  var newText = text.substring(0, lineStart) + resultText + text.substring(lineEnd);
  
  var debugMarker = "/* ========== ОТЛАДКА NameResolver ==========";
  var debugEndMarker = "*/";
  var debugStartIndex = newText.indexOf(debugMarker);
  if (debugStartIndex !== -1) {
    var debugEndIndex = newText.indexOf(debugEndMarker, debugStartIndex);
    if (debugEndIndex !== -1) {
      newText = newText.substring(0, debugStartIndex) + newText.substring(debugEndIndex + 2);
    }
  }
  
  newText = newText.trimEnd() + debugBlock;
  var newCursor = lineStart + resultText.length;
  
  api.setText(newText, newCursor);
  
  api.showHint('✅ ' + resultText + genderText + '\n📋 Отладка добавлена в конец файла', 4000);
}

// Экспорт
for (var key in NameResolver) {
  if (NameResolver.hasOwnProperty(key)) {
    exports[key] = NameResolver[key];
  }
}
