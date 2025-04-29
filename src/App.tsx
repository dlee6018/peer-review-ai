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

  const getRubricForOption = () => {
    return `You are a peer reviewer for a paper. The review should answer these questions about the paper:
    - What is the main goal of the project?
    - What are the main claims?
    - What are the experiments?
    - What is the evaluation protocol?
    - What is the data?
    - What is the task?
    - How do the experiments support the goal/claims of the paper?
    - Are any of the limitations discussed in the paper?
    - What are the strengths of the paper?
    - What are the weaknesses of the paper?
    - Provide a suggestion for improving the paper.
    - What is the relevant related work?
    - Is the paper reproducible?
    - Can you rerun the experiments?
    - Can you reproduce the results in the paper?
    - Are all the plots in the paper clearly interpretable with well-defined and explained axes, with the methodology clearly explained in the paper text?
    - Is the English in the paper correct and clear?
    - Do you have any feedback on any TODOs that the authors have left at this stage? 
    You should format the response as follows: 
    For each question, list the question in bold. Then, write a well written paragraph answering the question. 
    Leave a one line gap between the answer and the next question.
    `
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
        instructions: getRubricForOption(),
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
