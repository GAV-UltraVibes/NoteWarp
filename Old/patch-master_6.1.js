// PatchMaster v6.1
// модуль для редактора NoteWarp v7.0+
// используется для замены блоков кода, размеченных комментариями-якорями
// Синтаксис: 
//   В коде: // @anchor:имя-якоря-start ... // @anchor:имя-якоря-end
//   В патче: { "type": "anchor_replace", "startAnchor": "имя-начала", "endAnchor": "имя-конца", "with": "новый код" }
// @anchor:patchmaster-start
// @desc:Модуль патчинга кода по якорям @anchor

const PatchMaster = {
  id: "patch-master",
  name: "PatchMaster",
  version: "6.1",
  description: "Замена блоков между @anchor якорями. Используйте // @anchor:имя-start и // @anchor:имя-end в коде.",
  syntax: "[patch>\n{\n  \"meta\": { \"name\": \"Название\" },\n  \"changes\": [\n    { \"type\": \"anchor_replace\", \"startAnchor\": \"начало\", \"endAnchor\": \"конец\", \"with\": \"новый код\" }\n  ]\n}\n<patch]",
  
  logEntries: [],
  
  // ==================== ЛОГИРОВАНИЕ ====================
  // @anchor:patchmaster-logging-start
  // @desc:Методы логирования операций патчера
  
  log: function(level, message, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      details: details || null
    };
    this.logEntries.push(entry);
    console.log(`[PatchMaster ${level}] ${message}`, details || '');
  },
  
  clearLog: function() {
    this.logEntries = [];
    this.log('INFO', 'Лог очищен');
  },
  
  formatLog: function() {
    let output = '=== PatchMaster v' + this.version + ' Log ===\n';
    output += 'Время запуска: ' + new Date().toLocaleString() + '\n';
    output += 'User Agent: ' + navigator.userAgent + '\n';
    output += '='.repeat(50) + '\n\n';
    
    for (const entry of this.logEntries) {
      output += `[${entry.timestamp}] [${entry.level}] ${entry.message}\n`;
      if (entry.details) {
        if (typeof entry.details === 'string') {
          output += `  ${entry.details}\n`;
        } else {
          output += `  ${JSON.stringify(entry.details, null, 2).split('\n').map(l => '  ' + l).join('\n')}\n`;
        }
      }
      output += '\n';
    }
    
    output += '='.repeat(50) + '\nКонец лога\n';
    return output;
  },
  
  saveLogToFile: function() {
    const content = this.formatLog();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const filename = `patchmaster-log-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.txt`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    this.log('INFO', `Лог сохранён: ${filename}`);
    return filename;
  },
  // @anchor:patchmaster-logging-end
  
  // ==================== ПОИСК ЯКОРЕЙ ====================
  // @anchor:patchmaster-findanchor-start
  // @desc:Поиск якоря @anchor в тексте (поддерживает JS, CSS, HTML, многострочные)
  
  findAnchor: function(text, anchorName) {
    const escaped = anchorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      // JS/CSS однострочный: // @anchor:имя (может быть @desc на след. строке)
      { 
        regex: new RegExp(`\/\/\\s*@anchor:${escaped}(?:\\s|$)`, 'm'),
        type: 'js-line' 
      },
      // CSS блочный: /* @anchor:имя ... */
      { 
        regex: new RegExp(`\/\\*\\s*@anchor:${escaped}[^*]*\\*\/`, 'm'),
        type: 'css-block' 
      },
      // HTML: <!-- @anchor:имя ... -->
      { 
        regex: new RegExp(`<!--\\s*@anchor:${escaped}[^-]*-->`, 'm'),
        type: 'html' 
      }
    ];
    
    for (const p of patterns) {
      const match = text.match(p.regex);
      if (match) {
        this.log('DEBUG', `Якорь @anchor:${anchorName} найден`, { 
          type: p.type, 
          position: match.index,
          matched: match[0].substring(0, 80)
        });
        return { pos: match.index, length: match[0].length };
      }
    }
    
    this.log('WARN', `Якорь @anchor:${anchorName} не найден`);
    return null;
  },
  // @anchor:patchmaster-findanchor-end
  
  // ==================== ОПЕРАЦИЯ ЗАМЕНЫ ====================
  // @anchor:patchmaster-anchorreplace-start
  // @desc:Замена блока между startAnchor и endAnchor с сохранением отступов
  
  anchorReplace: function(text, startAnchor, endAnchor, newContent) {
    this.log('INFO', `Замена блока: @anchor:${startAnchor} → @anchor:${endAnchor}`);
    
    const start = this.findAnchor(text, startAnchor);
    if (!start) {
      this.log('ERROR', `Начальный якорь @anchor:${startAnchor} не найден`);
      return { text, success: false };
    }
    
    const afterStart = text.slice(start.pos + start.length);
    const end = this.findAnchor(afterStart, endAnchor);
    if (!end) {
      this.log('ERROR', `Конечный якорь @anchor:${endAnchor} не найден после начала`);
      return { text, success: false };
    }
    
    const blockStart = start.pos + start.length;
    const blockEnd = blockStart + end.pos;
    
    // Определяем отступ из строки после начального якоря
    const beforeBlock = text.slice(0, blockStart);
    const lastNewline = beforeBlock.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const line = text.slice(lineStart, blockStart);
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    
    // Применяем отступ к новому контенту (первая строка без отступа)
    const indentedContent = newContent.split('\n').map((line, i) => {
      if (i === 0 && line === '') return line;
      if (i === 0) return line;
      return indent + line;
    }).join('\n');
    
    const result = text.slice(0, blockStart) + indentedContent + text.slice(blockEnd);
    
    this.log('INFO', `Блок заменён`, {
      startAnchor: startAnchor,
      endAnchor: endAnchor,
      oldLength: blockEnd - blockStart,
      newLength: indentedContent.length
    });
    
    return { text: result, success: true };
  },
  // @anchor:patchmaster-anchorreplace-end
  
  // ==================== ПРИМЕНЕНИЕ ПАТЧА ====================
  // @anchor:patchmaster-applypatch-start
  // @desc:Применяет патч к тексту с проверками verify
  
  applyPatchToText: function(original, patch, patchStart, patchLength) {
    this.log('INFO', `Применение патча "${patch.meta.name}"`);
    
    // Удаляем сам патч из текста
    let result = original.slice(0, patchStart) + original.slice(patchStart + patchLength);
    
    // Проверка verify
    if (patch.verify) {
      if (patch.verify.mustContain) {
        for (const str of patch.verify.mustContain) {
          if (!result.includes(str)) {
            const err = `Текст не содержит обязательную строку "${str}"`;
            this.log('ERROR', err);
            throw new Error(err);
          }
          this.log('DEBUG', `mustContain: "${str}" — найдено`);
        }
      }
      if (patch.verify.mustNotContain) {
        for (const str of patch.verify.mustNotContain) {
          if (result.includes(str)) {
            const err = `Текст содержит запрещённую строку "${str}"`;
            this.log('ERROR', err);
            throw new Error(err);
          }
          this.log('DEBUG', `mustNotContain: "${str}" — не найдено (ок)`);
        }
      }
    }
    
    // Применяем изменения
    for (let i = 0; i < patch.changes.length; i++) {
      const change = patch.changes[i];
      this.log('INFO', `Изменение ${i+1}/${patch.changes.length}: ${change.type}`);
      
      if (change.type === 'anchor_replace') {
        const applied = this.anchorReplace(result, change.startAnchor, change.endAnchor, change.with);
        if (applied.success) {
          result = applied.text;
          this.log('INFO', `Изменение ${i+1} применено успешно`);
        } else {
          this.log('ERROR', `Не удалось применить изменение ${i+1}: ${change.startAnchor} → ${change.endAnchor}`);
        }
      } else {
        this.log('WARN', `Неизвестный тип изменения: ${change.type}`);
      }
    }
    
    return result;
  },
  // @anchor:patchmaster-applypatch-end
  
  // ==================== КНОПКА И ОБРАБОТЧИК ====================
  // @anchor:patchmaster-toolbarbutton-start
  // @desc:Кнопка на панели инструментов и обработчик применения патча
  
  toolbarButton: {
    text: "🔧 Применить патч",
    title: "Найти [patch>...<patch] в тексте и применить",
    onClick: function(api) {
      PatchMaster.clearLog();
      PatchMaster.log('INFO', 'Начало применения патча');
      
      const text = api.getText();
      const cursorPos = api.getCursor();
      
      // Ищем патч в тексте
      const match = text.match(/\[patch>([\s\S]*?)<patch\]/);
      if (!match) {
        api.showHint('❌ Не найден маркер [patch>...<patch]', 3000);
        PatchMaster.log('WARN', 'Маркер патча не найден в тексте');
        return;
      }
      
      PatchMaster.log('DEBUG', 'Патч найден в тексте', { position: match.index, length: match[0].length });
      
      try {
        const patch = JSON.parse(match[1].trim());
        
        if (!patch.meta?.name) {
          api.showHint('❌ В патче не указано meta.name', 3000);
          PatchMaster.log('ERROR', 'Отсутствует meta.name');
          return;
        }
        
        if (!patch.changes?.length) {
          api.showHint('❌ В патче нет изменений (changes)', 3000);
          PatchMaster.log('ERROR', 'Отсутствуют changes');
          return;
        }
        
        // Формируем список изменений для подтверждения
        let changesList = '';
        for (const c of patch.changes) {
          changesList += `\n  • ${c.type}: ${c.startAnchor} → ${c.endAnchor}`;
        }
        
        const confirmed = confirm(
          `Применить патч "${patch.meta.name}"?\n\nИзменений: ${patch.changes.length}${changesList}\n\nЛог будет доступен после применения.`
        );
        
        if (!confirmed) {
          api.showHint('⏸️ Применение отменено', 2000);
          PatchMaster.log('INFO', 'Применение отменено пользователем');
          return;
        }
        
        const newText = PatchMaster.applyPatchToText(text, patch, match.index, match[0].length);
        api.setText(newText, cursorPos);
        api.showHint(`✅ Патч "${patch.meta.name}" применён (изменений: ${patch.changes.length})`, 4000);
        
        // Показываем кнопку для сохранения лога
        PatchMaster.showLogButton(api);
        
      } catch(e) {
        PatchMaster.log('ERROR', 'Ошибка применения патча', { message: e.message, stack: e.stack });
        api.showHint(`❌ Ошибка: ${e.message}`, 5000);
      }
    }
  },
  
  // @anchor:patchmaster-showlogbutton-start
  // @desc:Показывает временную кнопку для сохранения лога
  
  showLogButton: function(api) {
    const existing = document.getElementById('patchmaster-log-btn');
    if (existing) existing.remove();
    
    const panel = document.querySelector('.tools-panel');
    if (!panel) return;
    
    const btn = document.createElement('button');
    btn.id = 'patchmaster-log-btn';
    btn.className = 'tool-btn';
    btn.textContent = '📋 Лог патча';
    btn.title = 'Сохранить лог последнего патча';
    btn.style.backgroundColor = '#6c757d';
    btn.onclick = () => {
      const fn = PatchMaster.saveLogToFile();
      api.showHint(`📋 Лог сохранён: ${fn}`, 3000);
    };
    
    panel.appendChild(btn);
    
    // Автоудаление через 60 секунд
    setTimeout(() => {
      if (btn.parentNode) btn.remove();
    }, 60000);
  },
  // @anchor:patchmaster-showlogbutton-end
  // @anchor:patchmaster-toolbarbutton-end
  
  // ==================== PROCESS (ЗАГЛУШКА) ====================
  // @anchor:patchmaster-process-start
  // @desc:Заглушка process, требуется для совместимости с системой модулей
  
  process: function(text, cursorPos, api) {
    // Патчер не обрабатывает текст при вводе — только через кнопку
    return { text, cursorPos };
  }
  // @anchor:patchmaster-process-end
};
// @anchor:patchmaster-end

// @anchor:patchmaster-export-start
// @desc:Экспорт модуля
if (typeof exports !== 'undefined') {
  for (let key in PatchMaster) exports[key] = PatchMaster[key];
} else if (typeof module !== 'undefined') {
  module.exports = PatchMaster;
} else {
  window.PatchMaster = PatchMaster;
}
// @anchor:patchmaster-export-end
