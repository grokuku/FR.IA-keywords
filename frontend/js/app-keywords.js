
    async function loadSections() {
      try {
        const res = await fetch(API + '/sections');
        sectionsList = await res.json();
        sectionSelect.innerHTML = '<option value="">Toutes sections</option>';
        for (const sec of sectionsList) {
          const opt = document.createElement('option');
          opt.value = sec.section_id;
          opt.textContent = sec.section_id + '. ' + sec.section_title + ' (' + sec.total + ')';
          sectionSelect.appendChild(opt);
        }
      } catch { sectionsList = []; }
    }

    async function loadSubsections(sectionId) {
      try {
        const url = sectionId ? (API + '/subsections?section=' + encodeURIComponent(sectionId)) : (API + '/subsections');
        const res = await fetch(url);
        const list = await res.json();
        subsectionSelect.innerHTML = '<option value="">Toutes sous-sections</option>';
        for (const sub of list) {
          const opt = document.createElement('option');
          opt.value = sub.subsection_id;
          opt.textContent = sub.subsection_id + ' — ' + sub.subsection_title + ' (' + sub.total + ')';
          subsectionSelect.appendChild(opt);
        }
      } catch {}
    }

    async function loadKeywords() {
      const kwLoading = document.getElementById('keywords-loading');
      if (kwLoading) kwLoading.classList.remove('hidden');
      try {
        const textQ = searchInput.value.trim();
      const negQ = searchNegInput.value.trim();
      const semQ = semanticInput.value.trim();
      const nsfw = getNsfwFilter();
      const section = sectionSelect.value;
      const subsection = subsectionSelect.value;
      const confidence = parseFloat(document.getElementById('filter-confidence').value) / 100 || 0;

      let semResults = null;
      if (semQ) {
        if (!semanticCache || semanticCache.text !== semQ || semanticCache.confidence !== confidence || semanticCache.section !== section || semanticCache.subsection !== subsection) {
          semResults = await fetchSemanticSearch(semQ, nsfw, section, subsection, confidence);
          if (semResults) semanticCache = { text: semQ, confidence: confidence, section: section, subsection: subsection, results: semResults };
        } else {
          semResults = semanticCache.results;
        }
      }

      // Appliquer les filtres texte (+) et exclusion (-) aux résultats sémantiques
      if (semResults !== null && (textQ || negQ)) {
        const qLower = textQ.toLowerCase();
        const negLower = negQ.toLowerCase();
        semResults = semResults.filter(function(kw) {
          const fields = [
            (kw.keyword || '').toLowerCase(),
            (kw.description || '').toLowerCase(),
            (kw.section_title || '').toLowerCase(),
            (kw.subsection_title || '').toLowerCase()
          ];
          if (qLower && !fields.some(function(f){ return f.includes(qLower); })) return false;
          if (negLower && fields.some(function(f){ return f.includes(negLower); })) return false;
          return true;
        });
      }

      // Ne pas fetcher l'API texte si la sémantique est active (filtrage fait ci-dessus)
      const [textResults] = await Promise.all([
        (!semQ && (textQ || negQ)) ? fetchTextSearch(textQ, negQ, nsfw, section, subsection) : Promise.resolve(null),
      ]);

      if (semResults !== null) {
        allKeywords = semResults;
      } else if (textResults !== null) {
        allKeywords = textResults;
      } else {
        // Aucune recherche active : charger tout
        try {
          const params = new URLSearchParams();
          if (section) params.append('section', section);
          if (subsection) params.append('subsection', subsection);
          if (nsfw !== '') params.append('nsfw', nsfw);
          const res = await fetch(API + '/keywords?' + params.toString());
          allKeywords = await res.json();
        } catch { allKeywords = []; }
      }
      renderTable(allKeywords);
      } finally {
        if (kwLoading) kwLoading.classList.add('hidden');
      }
    }

    async function fetchTextSearch(q, q_neg, nsfw, section, subsection) {
      try {
        const params = new URLSearchParams();
        params.append('q', q);
        if (q_neg) params.append('q_neg', q_neg);
        if (section) params.append('section', section);
        if (subsection) params.append('subsection', subsection);
        if (nsfw !== '') params.append('nsfw', nsfw);
        const res = await fetch(API + '/keywords?' + params.toString());
        return await res.json();
      } catch { return []; }
    }

    async function fetchSemanticSearch(q, nsfw, section, subsection, confidence) {
      semanticLoading.classList.remove('hidden');
      try {
        const params = new URLSearchParams();
        params.append('q', q);
        params.append('limit', '500');
        if (section) params.append('section', section);
        if (subsection) params.append('subsection', subsection);
        if (nsfw !== '') params.append('nsfw', nsfw);
        if (confidence > 0) params.append('confidence', confidence);
        const res = await fetch(API + '/search/semantic?' + params.toString());
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Erreur ' + res.status);
        }
        return await res.json();
      } catch (err) {
        console.error('Semantic search error:', err);
        return [];
      } finally {
        semanticLoading.classList.add('hidden');
      }
    }

    function applyFilters(preserveHidden) {
      if (!preserveHidden) hiddenKWs = {};
      loadKeywords();
    }

    function renderTable(rows) {
      tableBody.innerHTML = '';
      const isSemantic = semanticInput.value.trim() !== '';
      scoreHeader.classList.toggle('hidden', !isSemantic);
      // Filtrer les mots masques localement
      var hiddenCount = rows.filter(function(r){ return hiddenKWs[r.id]; }).length;
      if (rows.length === 0) {
        const colspan = isSemantic ? 4 : 3;
        tableBody.innerHTML = '<tr><td colspan="' + colspan + '" class="px-4 py-10 text-center text-slate-400 dark:text-slate-500">Aucun resultat trouve.</td></tr>';
        countDisplay.textContent = '0';
        countLabel.textContent = 'resultat';
        return;
      }
      if (hiddenCount === rows.length) {
        const colspan = isSemantic ? 4 : 3;
        tableBody.innerHTML = '<tr><td colspan="' + colspan + '" class="px-4 py-8 text-center text-sm text-slate-400">Tous les mots-cles sont masques. <button onclick="showAllHidden()" class="text-indigo-500 hover:underline">Tout reafficher</button></td></tr>';
        countDisplay.textContent = '0';
        countLabel.textContent = 'resultat (masques)';
        return;
      }
      const frag = document.createDocumentFragment();
      const isDark = document.documentElement.classList.contains('dark');
      var hiddenCount = 0;
      for (const row of rows) {
        var isHidden = !!hiddenKWs[row.id];
        if (isHidden) hiddenCount++;
        const tr = document.createElement('tr');
        tr.className = row.nsfw ? (isDark ? 'bg-rose-950/30' : 'bg-rose-50/40') : '';
        if (isHidden) tr.className += ' opacity-40 line-through decoration-1 decoration-slate-400';
        const nsfwClass = row.nsfw
          ? (isDark ? 'bg-rose-900/50 text-rose-300' : 'bg-rose-100 text-rose-700')
          : (isDark ? 'bg-slate-700 text-indigo-300' : 'bg-slate-100 text-indigo-600');
        const pct = Math.round((row.score || 0) * 100);
        const scoreTd = isSemantic
          ? '<td class="px-4 py-2 align-top w-24"><div class="score-bar' + (isDark ? ' bg-slate-700' : '') + '"><div class="score-bar-fill" style="width:' + pct + '%"></div></div><span class="text-xs text-slate-400 dark:text-slate-500">' + pct + '%</span></td>'
          : '';
        tr.innerHTML = '<td class="px-4 py-2 align-top"><div class="flex items-center gap-1"><button onclick="toggleHideKeyword(' + row.id + ')" title="' + (isHidden ? 'Reafficher' : 'Masquer') + '" class="text-xs transition p-0.5 leading-none ' + (isHidden ? 'text-rose-400' : 'text-slate-300 hover:text-rose-400') + '">' + (isHidden ? '🙈' : '👁️') + '</button><code class="text-xs font-mono px-1.5 py-0.5 rounded ' + nsfwClass + '">' + escapeHtml(row.keyword) + '</code></div></td>'
          + '<td class="px-4 py-2 text-slate-700 align-top dark:text-slate-300">' + escapeHtml(row.description) + '</td>'
          + '<td class="px-4 py-2 text-xs text-slate-500 align-top dark:text-slate-400 max-w-[160px]"><div class="font-medium text-slate-600 dark:text-slate-300 truncate">' + escapeHtml(row.subsection_title) + '</div><div class="text-slate-400 mt-0.5 dark:text-slate-500 truncate">' + escapeHtml(row.section_id) + '. ' + escapeHtml(row.section_title) + '</div></td>'
          + scoreTd;
        frag.appendChild(tr);
      }
      tableBody.appendChild(frag);
      initColResize();
      loadColWidths();
      countDisplay.textContent = rows.length - hiddenCount;
      countLabel.textContent = (rows.length - hiddenCount > 1 ? ' visibles' : ' visible') + (hiddenCount > 0 ? ' (+ ' + hiddenCount + ' masques)' : '');
    }

    function escapeHtml(str) {
      if (typeof str !== 'string') return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }    function escapeHtml(str) {
      if (typeof str !== 'string') return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }




    // === Elements Picker ===
    var genElementId = 0;
    var genElements = [];
    var genFilters = [];

    function genAddElement(type) {
      type = type || '';
      var id = ++genElementId;
      genElements.push({id: id, type: type, filterId: null, text: '', filterName: ''});
      genRender();
      if (type === 'filter') openFilterPick(id);
      if (type === 'text') openSemanticModal(id);
      saveEPState();
    }

    function genRemoveElement(id) {
      genElements = genElements.filter(function(e){ return e.id !== id; });
      genRender();
      saveEPState();
    }

    function genRender() {
      var container = document.getElementById('gen-elements');
      var html = '';
      if (genElements.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Ajoute un element via les boutons ci-dessous</p>';
        document.getElementById('gen-count').textContent = '0';
      } else {
        for (var i = 0; i < genElements.length; i++) {
          var el = genElements[i];
          html += '<div class="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/30 rounded p-1.5">';
          if (el.type === 'filter' && el.filterId) {
            html += '<span class="flex-1 text-xs text-indigo-600 dark:text-indigo-400 truncate">' + escapeHtml(el.filterName) + '</span>';
            html += '<button onclick="previewFilterCache(' + el.filterId + ')" class="text-xs text-slate-300 hover:text-indigo-400 p-0.5" title="Voir le cache">📊</button>';
            html += '<button onclick="genChangeType(' + el.id + ')" class="text-xs text-slate-400 hover:text-slate-600 p-0.5" title="Changer">↻</button>';
          } else if (el.type === 'text' && el.text) {
            html += '<span class="flex-1 text-xs text-emerald-600 dark:text-emerald-400 truncate">"' + escapeHtml(el.text).replace(/"/g, '&quot;') + '"</span>';
            html += '<button onclick="genChangeType(' + el.id + ')" class="text-xs text-slate-400 hover:text-slate-600 p-0.5" title="Changer">↻</button>';
          } else {
            html += '<span class="flex-1 text-xs text-slate-400 italic">En attente...</span>';
          }
          html += '<button onclick="genRemoveElement(' + el.id + ')" class="text-xs text-rose-400 hover:text-rose-300 p-1" title="Supprimer">&times;</button>';
          html += '</div>';
        }
        container.innerHTML = html;
        document.getElementById('gen-count').textContent = genElements.length;
      }
    }

    function genChangeType(id) {
      for (var i = 0; i < genElements.length; i++) {
        if (genElements[i].id === id) {
          genElements[i].type = '';
          genElements[i].filterId = null;
          genElements[i].text = '';
          genElements[i].filterName = '';
          break;
        }
      }
      genRender();
      saveEPState();
    }

    // Modal pour le texte semantique
    function openSemanticModal(elId) {
      showPrompt('Texte libre', 'Recherche semantique (mot ou phrase) :', 'ex: pose dynamique', function(txt){
        if (txt) {
          for (var i = 0; i < genElements.length; i++) {
            if (genElements[i].id === elId) { genElements[i].text = txt.trim(); break; }
          }
        } else {
          genElements = genElements.filter(function(e){ return e.id !== elId; });
        }
        genRender();
        saveEPState();
      });
    }

    // Persistance Elements Picker
    async function saveEPState() {
      if (!currentUser) return;
      var s = currentUser.settings || {};
      s.genElements = genElements.map(function(e){ return {type: e.type, filterId: e.filterId, text: e.text, filterName: e.filterName}; });
      try {
        await fetch(API + '/settings', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(s)
        });
        currentUser.settings = s;
      } catch (e) {}
    }

    function loadEPState() {
      if (currentUser && currentUser.settings && currentUser.settings.genElements) {
        var saved = currentUser.settings.genElements;
        genElements = [];
        saved.forEach(function(e) {
          genElements.push({id: ++genElementId, type: e.type || '', filterId: e.filterId || null, text: e.text || '', filterName: e.filterName || ''});
        });
        genRender();
      }
    }

    // Filter picker modal
    var fpTargetId = null;

    function openFilterPick(elementId) {
      fpTargetId = elementId;
      document.getElementById('modal-filter-pick').classList.remove('hidden');
      document.getElementById('modal-filter-pick').classList.add('flex');
      makeModalDraggable('fp-modal-header', 'fp-modal');
      loadFilterList();
    }

    function closeFilterPick() {
      var target = fpTargetId;
      fpTargetId = null;
      document.getElementById('modal-filter-pick').classList.add('hidden');
      document.getElementById('modal-filter-pick').classList.remove('flex');
      // Si l'utilisateur ferme sans choisir, enlever l'element
      for (var i = 0; i < genElements.length; i++) {
        if (genElements[i].id === target && !genElements[i].filterId) {
          genElements.splice(i, 1);
          genRender();
          saveEPState();
          break;
        }
      }
    }

    async function loadFilterList() {
      var owner = document.getElementById('fp-owner').value;
      var nsfw = document.getElementById('fp-nsfw').value;
      try {
        var res = await fetch(API + '/filters');
        if (!res.ok) return;
        var all = await res.json();
        var filtered = all.filter(function(f) {
          if (owner === 'mine' && f.user_id !== (currentUser ? currentUser.id : '')) return false;
          if (nsfw !== '' && f.nsfw !== parseInt(nsfw)) return false;
          return true;
        });
        var list = document.getElementById('fp-list');
        list.innerHTML = filtered.map(function(f) {
          var badge = f.nsfw ? '<span class="text-xs text-rose-400">NSFW</span>' : '<span class="text-xs text-emerald-400">SFW</span>';
          var pub = f.is_public ? '<span class="text-xs text-slate-400">public</span>' : '';
          var typeTag = f.filter_type === 'union' ? '<span class="text-xs text-amber-500 font-medium">[Union]</span> ' : '';
          return '<div class="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" onclick="pickFilter(' + f.id + ',\'' + escapeHtml(f.name).replace(/'/g,"\\'") + '\')">'
            + typeTag + '<span class="flex-1 text-slate-700 dark:text-slate-300">' + escapeHtml(f.name) + '</span>'
            + badge + ' ' + pub
            + '</div>';
        }).join('');
        if (filtered.length === 0) {
          list.innerHTML = '<p class="text-slate-400 text-center">Aucun filtre trouve</p>';
        }
      } catch {}
    }

    function pickFilter(filterId, name) {
      if (fpTargetId === -1) {
        // Mode "charger" depuis les filtres
        loadFilterIntoPanel(filterId);
      } else {
        // Mode "choisir" pour le generateur
        for (var i = 0; i < genElements.length; i++) {
          if (genElements[i].id === fpTargetId) {
            genElements[i].filterId = filterId;
            genElements[i].filterName = name;
            break;
          }
        }
        closeFilterPick();
        genRender();
        saveEPState();
      }
    }

    // Generation
    async function genGenerate() {
      var items = [];
      for (var i = 0; i < genElements.length; i++) {
        var el = genElements[i];
        if (el.type === 'filter' && el.filterId) items.push({type: 'filter', id: el.filterId});
        else if (el.type === 'text' && el.text) items.push({type: 'text', text: el.text});
      }
      if (items.length === 0) { showModal('Elements Picker', 'Ajoute un element (saved filter ou semantic) avant de generer', 'error'); return; }

      try {
        var res = await fetch(API + '/generate', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({elements: items})
        });
        if (!res.ok) {
          var err = await res.json().catch(function(){ return {}; });
          showModal('Erreur', err.error || 'Generation impossible', 'error');
          return;
        }
        var data = await res.json();
        var output = data.prompt;
        if (data.count === 0) output = '(aucun mot-cle trouve : verifie les filtres et le cache)';
        document.getElementById('gen-output').value = output;
        document.getElementById('gen-count').textContent = data.count;
      } catch (err) {
        showModal('Erreur', err.message || 'Une erreur est survenue', 'error');
      }
    }

    function genCopy() {
      var ta = document.getElementById('gen-output');
      ta.select();
      document.execCommand('copy');
    }
