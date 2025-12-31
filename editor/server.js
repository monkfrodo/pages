const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3333;

// Caminho para o arquivo HTML
const HTML_FILE = path.join(__dirname, '..', 'trabalho-1a1.html');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Extrai o conteúdo editável do HTML
function parseHTML(html) {
  const content = {
    hero: {
      title: extractText(html, /<h1>(.*?)<\/h1>/),
      tag: extractText(html, /class="hero-tag">(.*?)<\/span>/),
      paragraphs: extractHeroParagraphs(html)
    },
    sections: []
  };

  // Extrai cada seção
  const sectionRegex = /<section>[\s\S]*?<h2 class="section-title">(.*?)<\/h2>([\s\S]*?)<\/section>/g;
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    const title = match[1];
    const body = match[2];

    content.sections.push({
      title: title,
      content: extractSectionContent(body)
    });
  }

  // Extrai observação final
  const obsMatch = html.match(/<div class="observation">[\s\S]*?<h2 class="section-title">(.*?)<\/h2>([\s\S]*?)<\/div>/);
  if (obsMatch) {
    content.observation = {
      title: obsMatch[1],
      paragraphs: extractParagraphs(obsMatch[2])
    };
  }

  // Extrai footer
  content.footer = {
    signature: extractText(html, /class="signature">(.*?)<\/div>/),
    name: extractText(html, /class="footer-name">(.*?)<\/div>/)
  };

  return content;
}

function extractText(html, regex) {
  const match = html.match(regex);
  return match ? match[1].trim() : '';
}

function extractHeroParagraphs(html) {
  const heroMatch = html.match(/<section class="hero">[\s\S]*?<\/div>([\s\S]*?)<\/section>/);
  if (!heroMatch) return [];
  return extractParagraphs(heroMatch[1]);
}

function extractParagraphs(html) {
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    paragraphs.push(match[1].replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').trim());
  }
  return paragraphs;
}

function extractSectionContent(html) {
  const content = {
    paragraphs: [],
    list: [],
    price: null,
    priceNote: null,
    cta: null
  };

  // Extrai preço
  const priceMatch = html.match(/class="price">(.*?)<\/p>/);
  if (priceMatch) {
    content.price = priceMatch[1].trim();
  }

  // Extrai nota do preço
  const priceNoteMatch = html.match(/class="price-note">([\s\S]*?)<\/p>/);
  if (priceNoteMatch) {
    content.priceNote = priceNoteMatch[1].replace(/<br>/g, '\n').trim();
  }

  // Extrai CTA
  const ctaMatch = html.match(/href="([^"]*)"[^>]*class="cta-btn">([^<]*)<\/a>/);
  if (ctaMatch) {
    content.cta = {
      url: ctaMatch[1],
      text: ctaMatch[2]
    };
  }

  // Extrai lista
  const listMatch = html.match(/<ul>([\s\S]*?)<\/ul>/);
  if (listMatch) {
    const liRegex = /<li>([\s\S]*?)<\/li>/g;
    let liMatch;
    while ((liMatch = liRegex.exec(listMatch[1])) !== null) {
      content.list.push(liMatch[1].trim());
    }
  }

  // Extrai parágrafos (excluindo price e price-note)
  const pRegex = /<p(?![^>]*class="price)([^>]*)>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const classes = match[1];
    const text = match[2];
    if (!classes.includes('price')) {
      const cleanText = text.replace(/<br>/g, '\n').replace(/<strong>/g, '**').replace(/<\/strong>/g, '**').replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        content.paragraphs.push({
          text: cleanText,
          muted: classes.includes('muted')
        });
      }
    }
  }

  return content;
}

// Gera o HTML a partir do conteúdo
function generateHTML(content) {
  const sections = content.sections.map(section => {
    let sectionHTML = `        <section>
            <h2 class="section-title">${section.title}</h2>`;

    const c = section.content;

    // Parágrafos antes da lista
    c.paragraphs.forEach((p, i) => {
      if (c.list.length > 0 && i >= c.paragraphs.length - 1 && !c.price) {
        // Último parágrafo vai depois da lista se houver lista
      } else if (i === 0 || (c.list.length === 0 && i < c.paragraphs.length)) {
        const mutedClass = p.muted ? ' class="muted"' : '';
        const text = p.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        sectionHTML += `\n            <p${mutedClass}>${text}</p>`;
      }
    });

    // Lista
    if (c.list.length > 0) {
      sectionHTML += `\n            <ul>`;
      c.list.forEach(item => {
        sectionHTML += `\n                <li>${item}</li>`;
      });
      sectionHTML += `\n            </ul>`;
    }

    // Parágrafos depois da lista
    if (c.list.length > 0 && c.paragraphs.length > 1) {
      c.paragraphs.slice(1).forEach(p => {
        const mutedClass = p.muted ? ' class="muted"' : '';
        const text = p.text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        sectionHTML += `\n            <p${mutedClass}>${text}</p>`;
      });
    }

    // Preço
    if (c.price) {
      sectionHTML += `\n            <p class="price">${c.price}</p>`;
      if (c.priceNote) {
        sectionHTML += `\n            <p class="price-note">${c.priceNote.replace(/\n/g, '<br>')}</p>`;
      }
    }

    // CTA
    if (c.cta) {
      sectionHTML += `\n            <a href="${c.cta.url}" class="cta-btn">${c.cta.text}</a>`;
    }

    sectionHTML += `\n        </section>`;
    return sectionHTML;
  }).join('\n\n');

  // Observação
  const observation = `        <div class="observation">
            <h2 class="section-title">${content.observation.title}</h2>
${content.observation.paragraphs.map(p => `            <p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
        </div>`;

  // Footer
  const footer = `        <footer>
            <div class="signature">${content.footer.signature}</div>
            <div class="footer-name">${content.footer.name}</div>
        </footer>`;

  // Hero
  const hero = `        <section class="hero">
            <div class="hero-title">
                <h1>${content.hero.title}</h1>
                <span class="hero-tag">${content.hero.tag}</span>
            </div>
${content.hero.paragraphs.map(p => `            <p>${p}</p>`).join('\n')}
        </section>`;

  // Lê o template original para manter o CSS
  const originalHTML = fs.readFileSync(HTML_FILE, 'utf8');
  const styleMatch = originalHTML.match(/<style>[\s\S]*?<\/style>/);
  const headMatch = originalHTML.match(/<head>[\s\S]*?<\/head>/);

  return `<!DOCTYPE html>
<html lang="pt-BR">
${headMatch[0]}
<body>
    <main style="padding-top: 4rem;">
${hero}

${sections}

${observation}

${footer}
    </main>
</body>
</html>
`;
}

// API: Obter conteúdo atual
app.get('/api/content', (req, res) => {
  try {
    const html = fs.readFileSync(HTML_FILE, 'utf8');
    const content = parseHTML(html);
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Salvar conteúdo
app.post('/api/content', (req, res) => {
  try {
    const content = req.body;
    const html = generateHTML(content);
    fs.writeFileSync(HTML_FILE, html, 'utf8');
    res.json({ success: true, message: 'Arquivo salvo com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Preview do HTML gerado
app.post('/api/preview', (req, res) => {
  try {
    const content = req.body;
    const html = generateHTML(content);
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Deploy (commit + push)
app.post('/api/deploy', async (req, res) => {
  const { exec } = require('child_process');
  const pagesDir = path.join(__dirname, '..');

  const commands = [
    `cd "${pagesDir}" && git add trabalho-1a1.html`,
    `cd "${pagesDir}" && git commit -m "Atualização da página trabalho-1a1"`,
    `cd "${pagesDir}" && git push`
  ];

  try {
    for (const cmd of commands) {
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error && !error.message.includes('nothing to commit')) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
    }
    res.json({ success: true, message: 'Deploy realizado com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Editor rodando em http://localhost:${PORT}`);
  console.log(`📄 Editando: ${HTML_FILE}\n`);

  // Abre o navegador automaticamente
  const open = process.platform === 'darwin' ? 'open' :
               process.platform === 'win32' ? 'start' : 'xdg-open';
  require('child_process').exec(`${open} http://localhost:${PORT}`);
});