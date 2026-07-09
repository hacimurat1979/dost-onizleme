(function () {
  "use strict";

  const I18n = window.DostI18n;

  let allNodes = [];

  function initializeWithNodes(nodes) {
    allNodes = nodes.filter((n) => n.id); // ensure valid nodes
  }

  function getRandomConcept() {
    if (allNodes.length === 0) return null;
    const randomIdx = Math.floor(Math.random() * allNodes.length);
    return allNodes[randomIdx];
  }

  function discoverConcept() {
    const node = getRandomConcept();
    if (!node) return;

    // Try to find and click the node element in the SVG
    if (window.__ontologyApp && window.__ontologyApp.nodeById) {
      const nodeData = window.__ontologyApp.nodeById.get(node.id);
      if (nodeData) {
        // Find the SVG node group
        const nodeElements = document.querySelectorAll("g.ontology-node");
        let targetNode = null;

        // Match by finding the one with the same label
        for (const el of nodeElements) {
          const label = el.querySelector(".node-label")?.textContent;
          const nodeName = node.name ? node.name.tr || node.name.en : null;
          if (label && nodeName && label.trim() === nodeName.trim()) {
            targetNode = el;
            break;
          }
        }

        // Fallback: try first node if no exact match
        if (!targetNode && nodeElements.length > 0) {
          targetNode = nodeElements[Math.floor(Math.random() * nodeElements.length)];
        }

        if (targetNode) {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          });
          targetNode.dispatchEvent(clickEvent);
          return;
        }
      }
    }

    // Dispatch event for other views
    const event = new CustomEvent("dost-discover-node", { detail: { node } });
    window.dispatchEvent(event);
  }

  // Create discover button in header
  function init() {
    const headerControls = document.querySelector(".app-header__controls");
    if (!headerControls || document.getElementById("discover-btn")) return;

    const discoverBtn = document.createElement("button");
    discoverBtn.id = "discover-btn";
    discoverBtn.className = "btn-ghost";
    discoverBtn.type = "button";
    discoverBtn.setAttribute("data-tr", "Keşfet");
    discoverBtn.setAttribute("data-en", "Discover");
    discoverBtn.setAttribute("data-pt", "Descobrir");
    discoverBtn.textContent = "Keşfet";
    discoverBtn.title = "Rasgele bir kavram keş / Discover a random concept / Descobrir um conceito aleatório";

    // Insert before theme toggle
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      headerControls.insertBefore(discoverBtn, themeToggle);
    } else {
      headerControls.appendChild(discoverBtn);
    }

    discoverBtn.addEventListener("click", discoverConcept);
  }

  // Initialize when data is loaded
  // Listen for ontology app to load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Update nodes when ontology app is ready
  const checkOntology = () => {
    if (window.__ontologyApp && window.__ontologyApp.nodes) {
      initializeWithNodes(window.__ontologyApp.nodes);
      clearInterval(checkInterval);
    }
  };
  const checkInterval = setInterval(checkOntology, 100);
  setTimeout(() => clearInterval(checkInterval), 5000);

  window.__discoverConcept = { discoverConcept, getRandomConcept, initializeWithNodes };
})();
