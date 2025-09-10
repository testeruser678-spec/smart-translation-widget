(function(){
    // Load CSS dynamically
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://your-vercel-domain.com/widget.css";
    document.head.appendChild(link);

    // Widget container
    const widget = document.createElement("div");
    widget.id = "my-widget";
    widget.innerHTML = `
        <div>
            <select id="widget-language">
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
            </select>
            <button id="widget-translate">Translate Page</button>
        </div>
    `;
    document.body.appendChild(widget);

    const select = widget.querySelector("#widget-language");
    const button = widget.querySelector("#widget-translate");

    // Helper: Check if node should be ignored
    function shouldIgnore(node) {
        if(!node.textContent || !node.parentNode) return true;
        const tag = node.parentNode.tagName;
        const cls = node.parentNode.className;

        const ignoredTags = ["SCRIPT","STYLE","NOSCRIPT","CODE","PRE","IFRAME"];
        const ignoredClasses = ["material-icons","iconify","svg-icon","admin-bar","editor-toolbar"];
        
        if(ignoredTags.includes(tag)) return true;
        for(let c of ignoredClasses){
            if(cls && cls.includes(c)) return true;
        }
        // Hidden elements
        const style = window.getComputedStyle(node.parentNode);
        if(style.display === "none" || style.visibility === "hidden") return true;

        return false;
    }

    // Extract all text nodes
    function getTextNodes(root=document.body){
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while(node = walker.nextNode()){
            if(!shouldIgnore(node)) nodes.push(node);
        }
        return nodes;
    }

    // Apply translated text safely
    function applyTranslation(nodeMap){
        for(const [node, translated] of nodeMap){
            node.textContent = translated;
        }
    }

    // Translate all text nodes
    async function translatePage(){
        const target = select.value;
        const nodes = getTextNodes();
        const texts = nodes.map(n=>n.textContent.trim()).filter(t=>t);

        if(texts.length === 0) return;

        // Send batch to backend
        try{
            const resp = await fetch("https://your-vercel-domain.com/translate", {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({text: texts.join("\n"), target})
            });
            const data = await resp.json();
            const translatedLines = data.translated_text.split("\n");

            // Map back translations to nodes
            const nodeMap = nodes.map((n,i)=>[n, translatedLines[i] || n.textContent]);
            applyTranslation(nodeMap);

        } catch(e){
            console.error("Translation error:", e);
        }
    }

    button.addEventListener("click", translatePage);

    // Dynamic content handling
    const observer = new MutationObserver(mutations=>{
        for(const m of mutations){
            for(const node of m.addedNodes){
                if(node.nodeType === 1){ // ELEMENT_NODE
                    const textNodes = getTextNodes(node);
                    if(textNodes.length>0){
                        // optional: auto-translate newly added nodes
                        // For performance, you can debounce or skip
                    }
                }
            }
        }
    });

    observer.observe(document.body, {childList:true, subtree:true});

})();
