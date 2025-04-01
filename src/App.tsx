import { useState, useEffect } from "react";
import { OpenAI } from "openai";
import "./App.css";
import { jsPDF } from "jspdf";

function App() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>(() => {
    const savedKey = localStorage.getItem("openai_api_key");
    return savedKey || "";
  });
  const [client, setClient] = useState<OpenAI | null>(null);

  useEffect(() => {
    if (apiKey) {
      setClient(
        new OpenAI({
          apiKey: apiKey,
          dangerouslyAllowBrowser: true,
        })
      );
    }
  }, [apiKey]);

  const options = [
    { value: 0, label: "Your own project from outside of EECS" },
    { value: 1, label: "Theoretical/empirical study of in-context learning" },
    { value: 2, label: "Interpretability" },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (
      file &&
      (file.type === "application/pdf" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ) {
      setUploadedFile(file);
    } else {
      alert("Please upload a PDF or DOCX file");
    }
  };

  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = event.target.value;
    setApiKey(newKey);
    localStorage.setItem("openai_api_key", newKey);
  };

  const generatePDF = (text: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    // Set font and size
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    // Add title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Peer Review Report", pageWidth / 2, margin, { align: "center" });

    // Add date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const today = new Date().toLocaleDateString();
    doc.text(`Generated on: ${today}`, pageWidth / 2, margin + 10, {
      align: "center",
    });

    // Add horizontal line
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 15, pageWidth - margin, margin + 15);

    // Reset font for content
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Split text into paragraphs
    const paragraphs = text.split("\n\n");
    let y = margin + 30;

    // Process each paragraph
    paragraphs.forEach((paragraph) => {
      if (paragraph.trim()) {
        // Split text into lines that fit the page width
        const lines = doc.splitTextToSize(paragraph, maxWidth);

        // Check if we need a new page
        const lineHeight = 7; // Approximate height of each line
        const spaceNeeded = lines.length * lineHeight;

        if (y + spaceNeeded > pageHeight - margin) {
          doc.addPage();
          y = margin + 20;
        }

        // Add the lines to the page
        doc.text(lines, margin, y);
        y += spaceNeeded + 5; // Add some spacing between paragraphs
      }
    });

    // Save the PDF
    doc.save("peer-review.pdf");
  };

  const getRubricForOption = (option: number) => {
    const commonRubric = `
For all options, also evaluate:
1. Writing Quality:
   - Is the paper well-written and coherent?
   - Is the story clear and logical?
   - Is the paper self-contained?

2. Technical Depth:
   - Is there appropriate technical detail?
   - Are the methods properly explained?
   - Is the analysis thorough?

3. Impact and Contribution:
   - What is the significance of the findings?
   - How does this work contribute to the field?
   - What are the limitations and future directions?`;

    switch (option) {
      case 0:
        return `You are a peer reviewer for a paper. Please review the paper for ${options[option].label}.

Evaluate the following aspects:
1. Problem Domain and Novelty:
   - Is the problem clearly described in a new domain?
   - Is there a clear justification for applying deep learning techniques?
   - Is the domain expertise properly established?

2. Technical Implementation:
   - Are the deep learning techniques from the course appropriately applied?
   - Is there a clear comparison with traditional non-deep-learning approaches?
   - Are the implementation details and code structure well-documented?

3. Analysis and Results:
   - Are there clear loss curves for training and validation?
   - Is there systematic analysis and exploration?
   - Are the results properly compared with baselines?

4. Reproducibility:
   - Is there a complete GitHub repository with all code?
   - Are model checkpoints provided?
   - Is there clear documentation for replication?

${commonRubric}

Please provide a detailed review addressing these points, with specific examples and suggestions for improvement.`;

      case 1:
        return `You are a peer reviewer for a paper. Please review the paper for ${options[option].label}.

Evaluate the following aspects:
1. Research Question and Context:
   - Is the investigation clearly defined and novel?
   - Is there proper citation of relevant literature?
   - Is the work placed in proper intellectual context?

2. Methodology:
   - Is there clear replication of existing work?
   - Are the architectural choices or variations well-justified?
   - Is the training/test data generation process clear?

3. Analysis:
   - Are there comprehensive loss curves?
   - Is there systematic comparison with baselines?
   - Are the results properly analyzed and interpreted?

4. Technical Implementation:
   - Is the code well-documented and organized?
   - Are model checkpoints provided?
   - Is everything reproducible?

${commonRubric}

Please provide a detailed review addressing these points, with specific examples and suggestions for improvement.`;

      case 2:
        return `You are a peer reviewer for a paper. Please review the paper for ${options[option].label}.

Evaluate the following aspects:
1. Research Focus:
   - Is the interpretability question clearly defined?
   - Is there proper citation of relevant literature?
   - Is the work placed in proper intellectual context?

2. Methodology:
   - Are the chosen pre-trained models appropriate?
   - Is the interpretability approach well-justified?
   - Are the interventions or explorations clearly described?

3. Analysis:
   - Is there systematic investigation rather than just demonstration?
   - Are the findings properly analyzed and interpreted?
   - Is there clear evidence of mechanism understanding?

4. Technical Implementation:
   - Is the code well-documented and organized?
   - Is everything reproducible?
   - Are the experiments properly controlled?

${commonRubric}

Please provide a detailed review addressing these points, with specific examples and suggestions for improvement.`;

      default:
        return `You are a peer reviewer for a paper. Please provide a detailed review with specific examples and suggestions for improvement.`;
    }
  };

  const generatePeerReview = async () => {
    // Validate all required fields
    if (!apiKey) {
      alert("Please enter your OpenAI API key");
      return;
    }

    if (selectedOption === null) {
      alert("Please select a review type");
      return;
    }

    if (!uploadedFile) {
      alert("Please upload a file first");
      return;
    }

    // Validate file type
    if (
      uploadedFile.type !== "application/pdf" &&
      uploadedFile.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      alert("Please upload a valid PDF or DOCX file");
      return;
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (uploadedFile.size > MAX_FILE_SIZE) {
      alert("File size must be less than 10MB");
      return;
    }

    setIsLoading(true);
    setReviewResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("purpose", "user_data");

      const fileResponse = await fetch("https://api.openai.com/v1/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      const fileData = await fileResponse.json();

      if (!fileResponse.ok) {
        // Check specifically for API key error
        if (fileData.error?.message?.includes("Incorrect API key")) {
          throw new Error(
            "Invalid API key. Please check your API key and try again."
          );
        }
        throw new Error(
          `File upload failed: ${fileData.error?.message || "Unknown error"}`
        );
      }

      if (!client) {
        throw new Error("OpenAI client not initialized");
      }

      const response = await client.responses.create({
        model: "gpt-4o",
        instructions: getRubricForOption(selectedOption),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                file_id: fileData.id,
              },
            ],
          },
        ],
      });

      setReviewResult(response.output_text);
      generatePDF(response.output_text);
    } catch (error) {
      console.error("Error:", error);
      // Display the specific error message to the user
      alert(
        error instanceof Error
          ? error.message
          : "An error occurred while processing the file. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1 className="app-title">CS 182 Spring 25 Peer Review AI</h1>

      <div className="form-group">
        <label className="form-label">OpenAI API Key:</label>
        <input
          type="password"
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="Enter your OpenAI API key"
        />
        <div className="api-key-hint">
          Your API key is stored locally and never sent to our servers
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Select Review Type:</label>
        <select
          value={selectedOption ?? ""}
          onChange={(e) => setSelectedOption(Number(e.target.value))}
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Upload Paper:</label>
        <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
        {uploadedFile && (
          <div className="file-name">Selected file: {uploadedFile.name}</div>
        )}
      </div>

      <button onClick={generatePeerReview} disabled={isLoading || !apiKey}>
        {isLoading ? "Generating Review..." : "Generate Peer Review"}
      </button>

      {isLoading && (
        <div style={{ marginTop: "2rem" }}>
          <div className="loader"></div>
        </div>
      )}

      {reviewResult && (
        <div className="result-container">
          <h3 className="result-title">Review Result:</h3>
          <pre className="result-text">{reviewResult}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
