// src/data/knowledge/workflowKnowledge.js

const workflowData = [
  {
    category: "Client Creation",
    action: "Conversational Intake",
    problem: "Form filling (Address, Phone, Email) is tedious.",
    solution: "Nuru interviews the user and builds the record via entity extraction.",
    metadata: { type: "intake", difficulty: "Medium" }
  },
  {
    category: "Matter Management",
    action: "Predictive Practice Area Mapping",
    problem: "High cognitive load from switching screens.",
    solution: "Analyze description to autonomously select Practice Area (e.g., 'lease' -> 'Real Estate').",
    metadata: { type: "transition", difficulty: "Low" }
  }
  // Add the rest of your items here
];

module.exports = workflowData;
