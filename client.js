// Browser half: a dedicated settings section for the AI reviewer model.
window.__ModuleLoader__.load({
  id: 'dshx-ai-approval',
  factory: (require) => {
    const React = require('react')
    const exports = {}
    function Section() {
      const [catalog, setCatalog] = React.useState(null)
      const [saved, setSaved] = React.useState(null)
      const [choice, setChoice] = React.useState({ provider: '', model: '', fallbackProvider: '', fallbackModel: '' })
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      React.useEffect(() => {
        let active = true
        Promise.all([
          fetch('/dshx-ai-approval/config', { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw Error('插件未就绪'); return r.json() }),
          fetch('/dshx-ai-approval/models', { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw Error('模型目录不可用'); return r.json() }),
        ]).then(([config, models]) => {
          if (!active) return
          setSaved(config)
          setChoice({ provider: config.provider || '', model: config.model || '', fallbackProvider: config.fallbackProvider || '', fallbackModel: config.fallbackModel || '' })
          setCatalog(models)
        }).catch((e) => { if (active) setError(e.message) })
        return () => { active = false }
      }, [])
      const groups = catalog?.groups || []
      const current = groups.find((group) => group.id === choice.provider)
      const backup = groups.find((group) => group.id === choice.fallbackProvider)
      const style = { color: 'inherit', background: 'transparent', border: '1px solid #8888', borderRadius: 8, padding: '8px 12px', maxWidth: '100%' }
      async function save() {
        setBusy(true); setError('')
        try {
          const response = await fetch('/dshx-ai-approval/config', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(choice) })
          const body = await response.json()
          if (!response.ok) throw Error(body.error || '保存失败')
          setSaved(body)
        } catch (e) { setError(e.message) }
        finally { setBusy(false) }
      }
      return React.createElement('div', { style: { padding: '18px 22px', display: 'grid', gap: 14, maxWidth: 650 } },
        React.createElement('h2', { style: { margin: 0, fontSize: 17 } }, 'AI 审批'),
        React.createElement('p', { style: { margin: 0, opacity: .7, fontSize: 13, lineHeight: 1.6 } }, '新对话默认使用「由 AI 审批」（也可在权限菜单切换）：工作区内正常操作；越界操作先由主审批模型判断。主模型出错、超时或冷却时改由备用模型判断；AI 同意则直接放行，AI 拒绝或都不可用时转人工审批。审批模型只能批准单次操作，不能切换权限模式。'),
        React.createElement('label', null, '审批服务商', React.createElement('br'), React.createElement('select', { style, value: choice.provider, onChange: (e) => {
          const provider = e.target.value
          setChoice({ provider, model: (groups.find((g) => g.id === provider)?.models || [])[0]?.id || '' })
        } }, React.createElement('option', { value: '' }, '请选择'), ...groups.map((group) => React.createElement('option', { key: group.id, value: group.id }, group.name || group.id)))),
        React.createElement('label', null, '审批模型', React.createElement('br'), React.createElement('select', { style, value: choice.model, onChange: (e) => setChoice({ ...choice, model: e.target.value }) }, React.createElement('option', { value: '' }, '请选择'), ...(current?.models || []).map((model) => React.createElement('option', { key: model.id, value: model.id }, model.name || model.id)))),
        React.createElement('label', null, '备用服务商（可选）', React.createElement('br'), React.createElement('select', { style, value: choice.fallbackProvider, onChange: (e) => {
          const fallbackProvider = e.target.value
          setChoice({ ...choice, fallbackProvider, fallbackModel: fallbackProvider ? (groups.find((g) => g.id === fallbackProvider)?.models || [])[0]?.id || '' : '' })
        } }, React.createElement('option', { value: '' }, '不使用备用模型'), ...groups.map((group) => React.createElement('option', { key: group.id, value: group.id }, group.name || group.id)))),
        choice.fallbackProvider ? React.createElement('label', null, '备用模型', React.createElement('br'), React.createElement('select', { style, value: choice.fallbackModel, onChange: (e) => setChoice({ ...choice, fallbackModel: e.target.value }) }, React.createElement('option', { value: '' }, '请选择'), ...(backup?.models || []).map((model) => React.createElement('option', { key: model.id, value: model.id }, model.name || model.id)))) : null,
        React.createElement('div', null, React.createElement('button', { style, disabled: busy || !choice.provider || !choice.model || (!!choice.fallbackProvider && !choice.fallbackModel), onClick: save }, busy ? '保存中…' : '保存审批模型'), saved?.provider ? React.createElement('span', { style: { marginLeft: 12, fontSize: 12, opacity: .7 } }, `当前：${saved.provider} / ${saved.model}` + (saved.fallbackProvider ? `；备用：${saved.fallbackProvider} / ${saved.fallbackModel}` : '')) : null),
        error ? React.createElement('div', { role: 'alert', style: { color: '#e45b55', fontSize: 12 } }, error) : null)
    }
    // ---------------------------------------------------------------------
    // Permission-menu glyph. DSH only draws icons for its three built-in
    // presets and leaves host-configured presets bare, so "由 AI 审批" lost its
    // icon after the upgrade. Re-add it on the rendered DOM: same 16px shield
    // outline and 1px stroke as the built-ins, with a sparkle for "AI". In the
    // dropdown the glyph reuses the built-in rows' icon-slot class, so spacing
    // and colour follow the theme exactly.
    // ---------------------------------------------------------------------
    const AI_LABELS = new Set(['由 AI 审批', 'AI 审批', 'Ai Approval', 'AI Approval'])
    const SVG_NS = 'http://www.w3.org/2000/svg'
    const SHIELD = 'M6.59624 2.14853C7.50155 1.80917 8.49914 1.80919 9.40444 2.14859L13.9245 3.84317V7.11961C13.9245 11.6089 10.5565 13.5975 8.00035 14.5779C5.44423 13.5975 2.07544 11.6089 2.07544 7.11961V3.84317L6.59624 2.14853Z'
    const SPARK = 'M7.4 4.6L8.05 6.55L10 7.2L8.05 7.85L7.4 9.8L6.75 7.85L4.8 7.2L6.75 6.55L7.4 4.6ZM10.35 9.1L10.7 10.1L11.7 10.45L10.7 10.8L10.35 11.8L10 10.8L9 10.45L10 10.1L10.35 9.1Z'
    function makeGlyph(size) {
      const svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size))
      svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('fill', 'none')
      svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('stroke-width', '1')
      svg.setAttribute('data-dshx-ai-glyph', '')
      const shield = document.createElementNS(SVG_NS, 'path')
      shield.setAttribute('d', SHIELD); shield.setAttribute('stroke', 'currentColor'); shield.setAttribute('stroke-linejoin', 'round')
      const spark = document.createElementNS(SVG_NS, 'path')
      spark.setAttribute('d', SPARK); spark.setAttribute('fill', 'currentColor')
      svg.append(shield, spark)
      return svg
    }
    const labelOf = (el) => (el?.textContent || '').trim()
    // Dropdown rows: <button role=menuitem><span.itemIcon><svg/></span><span.itemLabel>…</span>…</button>
    function decorateMenu(menu) {
      const rows = Array.from(menu.querySelectorAll('[role="menuitem"]'))
      const sample = rows.map((row) => row.firstElementChild).find((span) => span && !span.hasAttribute('data-dshx-ai-icon') && span.children.length === 1 && span.firstElementChild.tagName.toLowerCase() === 'svg')
      if (!sample) return
      for (const row of rows) {
        if (row.querySelector('[data-dshx-ai-glyph]')) continue
        const labelSpan = Array.from(row.children).find((child) => AI_LABELS.has(labelOf(child)))
        if (!labelSpan) continue
        const slot = document.createElement('span')
        slot.className = sample.className
        slot.setAttribute('data-dshx-ai-icon', '')
        slot.append(makeGlyph(14))
        row.insertBefore(slot, labelSpan)
      }
    }
    // Composer trigger: [icon?][label][chevron]. The icon span is only rendered
    // for built-ins; the built-in triggerIcon style is inline-flex, flex:none, 14px.
    function decorateTriggers() {
      for (const button of document.querySelectorAll('button[aria-label]')) {
        const existing = button.querySelector(':scope > [data-dshx-ai-icon]')
        const kids = Array.from(button.children).filter((child) => child !== existing)
        const labelSpan = kids.find((child) => child.tagName === 'SPAN' && AI_LABELS.has(labelOf(child)))
        if (!labelSpan) { if (existing) existing.remove(); continue }
        if (existing) continue
        if (!kids.some((child) => child !== labelSpan && child.querySelector('svg'))) continue
        const slot = document.createElement('span')
        slot.setAttribute('aria-hidden', 'true')
        slot.setAttribute('data-dshx-ai-icon', '')
        slot.style.cssText = 'display:inline-flex;flex:none'
        slot.append(makeGlyph(14))
        button.insertBefore(slot, labelSpan)
      }
    }
    let queued = false
    function scan() {
      queued = false
      try {
        for (const menu of document.querySelectorAll('[role="menu"]')) decorateMenu(menu)
        decorateTriggers()
      } catch (e) { /* cosmetic only */ }
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(scan) } }
    if (typeof window !== 'undefined' && !window.__dshxAiApprovalGlyph) {
      window.__dshxAiApprovalGlyph = true
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
      schedule()
    }

    exports.inject = ['slots']
    exports.apply = (ctx) => ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dshx-ai-approval', order: 31, label: 'AI 审批' }, Section))
    return exports
  },
})
