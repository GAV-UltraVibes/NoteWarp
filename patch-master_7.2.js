// PatchMaster v7.2 — замена блоков между [имя> и <имя] + вставка между маркерами

const PatchMaster = {
  id: "patch-master",
  name: "PatchMaster",
  version: "7.2",
  description: "Замена блоков между маркерами [имя> и <имя], вставка между маркерами",
  syntax: "[patch>\n{\n  \"meta\": { \"name\": \"Название\" },\n  \"changes\": [\n    { \"type\": \"replace\", \"marker\": \"имя\", \"with\": \"новый код\" },\n    { \"type\": \"insert_between\", \"startMarker\": \"якорь1\", \"endMarker\": \"якорь2\", \"with\": \"новый код между\" }\n  ]\n}\n<patch]",

  logEntries: [],

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

  findMarker: function(text, markerName, isClosing) {
    const marker = isClosing ? `<${markerName}]` : `[${markerName}>`;
    // Ищем маркер с учётом комментариев: //, /* */, <!-- -->
    const regex = new RegExp(`\\/\\/\\s*\\${marker}|\\/\\*\\s*\\${marker}\\s*\\*\\/|<!--\\s*\\${marker}\\s*-->|\\${marker}`, 'm');
    const match = text.match(regex);
    if (match) {
      this.log('DEBUG', `Маркер ${marker} найден`, { position: match.index });
      return { pos: match.index, length: match[0].length };
    }
    this.log('WARN', `Маркер ${marker} не найден`);
    return null;
  },

  findBlock: function(text, markerName) {
    const openMarker = this.findMarker(text, markerName, false);
    if (!openMarker) return null;
    
    const afterOpen = text.slice(openMarker.pos + openMarker.length);
    const closeMarker = this.findMarker(afterOpen, markerName, true);
    if (!closeMarker) return null;
    
    return {
      start: openMarker.pos,
      openEnd: openMarker.pos + openMarker.length,
      closeStart: openMarker.pos + openMarker.length + closeMarker.pos,
      end: openMarker.pos + openMarker.length + closeMarker.pos + closeMarker.length
    };
  },

  getIndent: function(text, position) {
    const beforePos = text.slice(0, position);
    const lastNewline = beforePos.lastIndexOf('\n');
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const line = text.slice(lineStart, position);
    const indentMatch = line.match(/^(\s*)/);
    return indentMatch ? indentMatch[1] : '';
  },

  formatContent: function(content, indent) {
    if (!content.includes('\n')) {
      return '\n' + indent + content + '\n' + indent;
    }
    return content.split('\n').map((line, i) => {
      if (i === 0) return line;
      return indent + line;
    }).join('\n');
  },

  replaceBlock: function(text, markerName, newContent) {
    this.log('INFO', `Замена блока: [${markerName}> ... <${markerName}]`);
    
    const block = this.findBlock(text, markerName);
    if (!block) {
      this.log('ERROR', `Блок с маркером ${markerName} не найден`);
      return { text, success: false };
    }
    
    const indent = this.getIndent(text, block.start);
    const formattedContent = this.formatContent(newContent, indent);
    
    const result = text.slice(0, block.openEnd) + formattedContent + text.slice(block.closeStart);
    
    this.log('INFO', `Блок заменён`, {
      marker: markerName,
      oldLength: block.closeStart - block.openEnd,
      newLength: formattedContent.length
    });
    
    return { text: result, success: true };
  },

  insertBetween: function(text, startMarkerName, endMarkerName, newContent) {
    this.log('INFO', `Вставка между маркерами: ${startMarkerName} → ${endMarkerName}`);
    
    const startBlock = this.findBlock(text, startMarkerName);
    if (!startBlock) {
      this.log('ERROR', `Стартовый маркер ${startMarkerName} не найден`);
      return { text, success: false };
    }
    
    const endBlock = this.findBlock(text, endMarkerName);
    if (!endBlock) {
      this.log('ERROR', `Конечный маркер ${endMarkerName} не найден`);
      return { text, success: false };
    }
    
    if (endBlock.start <= startBlock.end) {
      this.log('ERROR', `Конечный маркер должен быть после стартового`);
      return { text, success: false };
    }
    
    const beforeEnd = text.slice(0, endBlock.start);
    const afterEnd = text.slice(endBlock.start);
    
    const indent = this.getIndent(text, startBlock.end);
    const formattedContent = this.formatContent(newContent, indent);
    
    const result = beforeEnd + formattedContent + afterEnd;
    
    this.log('INFO', `Вставка выполнена`, {
      between: `${startMarkerName} → ${endMarkerName}`,
      insertedLength: formattedContent.length,
      position: endBlock.start
    });
    
    return { text: result, success: true };
  },

  applyPatchToText: function(original, patch, patchStart, patchLength) {
    this.log('INFO', `Применение патча "${patch.meta.name}"`);
    
    let result = original.slice(0, patchStart) + original.slice(patchStart + patchLength);
    
    if (patch.verify) {
      if (patch.verify.mustContain) {
        for (const str of patch.verify.mustContain) {
          if (!result.includes(str)) {
            throw new Error(`Текст не содержит "${str}"`);
          }
          this.log('DEBUG', `mustContain: "${str}" — найдено`);
        }
      }
      if (patch.verify.mustNotContain) {
        for (const str of patch.verify.mustNotContain) {
          if (result.includes(str)) {
            throw new Error(`Текст содержит "${str}"`);
          }
          this.log('DEBUG', `mustNotContain: "${str}" — не найдено`);
        }
      }
    }
    
    for (let i = 0; i < patch.changes.length; i++) {
      const change = patch.changes[i];
      this.log('INFO', `Изменение ${i+1}/${patch.changes.length}: ${change.type}`);
      
      let applied;
      if (change.type === 'replace') {
        const marker = change.marker || change.startMarker;
        if (!marker) {
          this.log('ERROR', 'Не указан marker в изменении');
          continue;
        }
        applied = this.replaceBlock(result, marker, change.with);
      } else if (change.type === 'insert_between') {
        const startMarker = change.startMarker;
        const endMarker = change.endMarker;
        if (!startMarker || !endMarker) {
          this.log('ERROR', 'Не указаны startMarker и endMarker для insert_between');
          continue;
        }
        applied = this.insertBetween(result, startMarker, endMarker, change.with);
      } else {
        this.log('WARN', `Неизвестный тип: ${change.type}`);
        continue;
      }
      
      if (applied.success) {
        result = applied.text;
        this.log('INFO', `Изменение ${i+1} применено успешно`);
      } else {
        this.log('ERROR', `Не удалось применить изменение ${i+1}`);
      }
    }
    
    return result;
  },

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
          if (c.type === 'replace') {
            changesList += `\n  • replace: ${c.marker || c.startMarker || '?'}`;
          } else if (c.type === 'insert_between') {
            changesList += `\n  • insert_between: ${c.startMarker} → ${c.endMarker}`;
          }
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
        
        const existing = document.getElementById('patchmaster-log-btn');
        if (existing) existing.remove();
        
        const panel = document.querySelector('.tools-panel');
        if (panel) {
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
          setTimeout(() => btn.remove(), 60000);
        }
        
      } catch(e) {
        PatchMaster.log('ERROR', e.message);
        api.showHint(`❌ ${e.message}`, 5000);
      }
    }
  },

  process: function(text, cursorPos, api) {
    return { text, cursorPos };
  }
};

if (typeof exports !== 'undefined') {
  for (let key in PatchMaster) exports[key] = PatchMaster[key];
} else if (typeof module !== 'undefined') {
  module.exports = PatchMaster;
} else {
  window.PatchMaster = PatchMaster;
}
