// PatchMaster v6.0 — замена блоков между @anchor якорями
// Использование: 
//   В коде: // @anchor:имя-якоря
//   В патче: { "type": "anchor_replace", "startAnchor": "имя-начала", "endAnchor": "имя-конца", "with": "новый код" }

const PatchMaster = {
  id: "patch-master",
  name: "PatchMaster",
  version: "6.0",
  description: "Замена блоков между @anchor якорями. Используйте // @anchor:имя в коде.",
  syntax: "[patch>\n{\n  \"meta\": { \"name\": \"Название\" },\n  \"changes\": [\n    { \"type\": \"anchor_replace\", \"startAnchor\": \"начало\", \"endAnchor\": \"конец\", \"with\": \"новый код\" }\n  ]\n}\n<patch]",
  
  logEntries: [],
  
  // ==================== ЛОГИРОВАНИЕ ====================
  
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
  
  // ==================== ПОИСК ЯКОРЕЙ ====================
  
  findAnchor: function(text, anchorName) {
    const patterns = [
      { regex: new RegExp(`// @anchor:${anchorName}\\b`), type: 'js-line' },
      { regex: new RegExp(`/\\* @anchor:${anchorName} \\*/`), type: 'js-block' },
      { regex: new RegExp(`<!-- @anchor:${anchorName} -->`), type: 'html' }
    ];
    
    for (const p of patterns) {
      const match = text.match(p.regex);
      if (match) {
        this.log('DEBUG', `Якорь @anchor:${anchorName} найден`, { type: p.type, position: match.index });
        return { pos: match.index, length: match[0].length };
      }
    }
    
    this.log('WARN', `Якорь @anchor:${anchorName} не найден`);
    return null;
  },
  
  // ==================== ОПЕРАЦИЯ ЗАМЕНЫ ====================
  
  anchorReplace: function(text, startAnchor, endAnchor, newContent) {
    this.log('INFO', `Замена блока: @anchor:${startAnchor} → @anchor:${endAnchor}`);
    
    const start = this.findAnchor(text, startAnchor);
    if (!start) return { text, success: false };
    
    const afterStart = text.slice(start.pos + start.length);
    const end = this.findAnchor(afterStart, endAnchor);
    if (!end) {
      this.log('ERROR', `Конечный якорь @anchor:${endAnchor} не найден после начала`);
      return { text, success: false };
    }
    
    const blockStart = start.pos + start.length;
    const blockEnd = blockStart + end.pos;
    
    // Находим отступ из строки после начального якоря
    const beforeBlock = text.slice(0, blockStart);
    const lastNewline = beforeBlock.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const line = text.slice(lineStart, blockStart);
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    
    // Применяем отступ к новому контенту (кроме первой строки)
    const indentedContent = newContent.split('\n').map((line, i) => {
      if (i === 0) return line;
      return indent + line;
    }).join('\n');
    
    const result = text.slice(0, blockStart) + indentedContent + text.slice(blockEnd);
    
    this.log('INFO', `Блок заменён`, {
      oldLength: blockEnd - blockStart,
      newLength: indentedContent.length
    });
    
    return { text: result, success: true };
  },
  
  // ==================== ПРИМЕНЕНИЕ ПАТЧА ====================
  
  applyPatchToText: function(original, patch, patchStart, patchLength) {
    this.log('INFO', `Применение патча "${patch.meta.name}"`);
    
    // Удаляем сам патч
    let result = original.slice(0, patchStart) + original.slice(patchStart + patchLength);
    
    // Проверка verify
    if (patch.verify) {
      if (patch.verify.mustContain) {
        for (const str of patch.verify.mustContain) {
          if (!result.includes(str)) {
            throw new Error(`Текст не содержит "${str}"`);
          }
        }
      }
      if (patch.verify.mustNotContain) {
        for (const str of patch.verify.mustNotContain) {
          if (result.includes(str)) {
            throw new Error(`Текст содержит "${str}"`);
          }
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
        } else {
          this.log('ERROR', `Не удалось применить изменение ${i+1}`);
        }
      } else {
        this.log('WARN', `Неизвестный тип: ${change.type}`);
      }
    }
    
    return result;
  },
  
  // ==================== КНОПКА И ОБРАБОТЧИК ====================
  
  toolbarButton: {
    text: "🔧 Применить патч",
    title: "Найти [patch>...<patch] и применить",
    onClick: function(api) {
      PatchMaster.clearLog();
      PatchMaster.log('INFO', 'Начало применения патча');
      
      const text = api.getText();
      const cursorPos = api.getCursor();
      
      const match = text.match(/\[patch>([\s\S]*?)<patch\]/);
      if (!match) {
        api.showHint('❌ Не найден маркер [patch>...<patch]', 3000);
        return;
      }
      
      try {
        const patch = JSON.parse(match[1].trim());
        
        if (!patch.meta?.name) {
          api.showHint('❌ Нет meta.name', 3000);
          return;
        }
        
        if (!patch.changes?.length) {
          api.showHint('❌ Нет изменений', 3000);
          return;
        }
        
        let changesList = '';
        for (const c of patch.changes) {
          changesList += `\n  - ${c.startAnchor} → ${c.endAnchor}`;
        }
        
        const confirmed = confirm(
          `Применить "${patch.meta.name}"?\nИзменений: ${patch.changes.length}${changesList}`
        );
        
        if (!confirmed) {
          api.showHint('⏸️ Отменено', 2000);
          return;
        }
        
        const newText = PatchMaster.applyPatchToText(text, patch, match.index, match[0].length);
        api.setText(newText, cursorPos);
        api.showHint(`✅ "${patch.meta.name}" применён`, 4000);
        
        PatchMaster.showLogButton(api);
        
      } catch(e) {
        PatchMaster.log('ERROR', 'Ошибка', { message: e.message });
        api.showHint(`❌ ${e.message}`, 5000);
      }
    }
  },
  
  showLogButton: function(api) {
    const existing = document.getElementById('patchmaster-log-btn');
    if (existing) existing.remove();
    
    const panel = document.querySelector('.tools-panel');
    if (!panel) return;
    
    const btn = document.createElement('button');
    btn.id = 'patchmaster-log-btn';
    btn.className = 'tool-btn';
    btn.textContent = '📋 Лог';
    btn.title = 'Сохранить лог';
    btn.style.backgroundColor = '#6c757d';
    btn.onclick = () => {
      const fn = PatchMaster.saveLogToFile();
      api.showHint(`📋 ${fn}`, 3000);
    };
    
    panel.appendChild(btn);
    setTimeout(() => btn.remove(), 30000);
  },
  
  process: function(text, cursorPos, api) {
    return { text, cursorPos };
  }
};

// Экспорт
if (typeof exports !== 'undefined') {
  for (let key in PatchMaster) exports[key] = PatchMaster[key];
} else if (typeof module !== 'undefined') {
  module.exports = PatchMaster;
} else {
  window.PatchMaster = PatchMaster;
}