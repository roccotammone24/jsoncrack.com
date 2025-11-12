import React, { useState, useEffect } from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// Get the full node value from the JSON
const getFullNodeValue = (json: string, path?: NodeData["path"]): any => {
  try {
    const obj = JSON.parse(json);
    if (!path || path.length === 0) return obj;

    let current = obj;
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }
    return current;
  } catch (error) {
    console.error("Error getting full node value:", error);
    return null;
  }
};

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Update JSON at a given path
const updateJsonAtPath = (json: string, path: NodeData["path"], newValue: any): string => {
  try {
    const obj = JSON.parse(json);
    if (!path || path.length === 0) return JSON.stringify(newValue, null, 2);

    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = newValue;

    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error("Error updating JSON at path:", error);
    return json;
  }
};

// Parse edited content to handle both single values and objects
const parseEditedContent = (content: string): any => {
  try {
    return JSON.parse(content);
  } catch {
    // If it's not valid JSON, try to treat it as a single string value
    return content;
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");

  useEffect(() => {
    if (nodeData) {
      // Get the full value from JSON, not just the normalized view
      const json = useJson.getState().json;
      const fullValue = getFullNodeValue(json, nodeData.path);
      const content = fullValue !== null 
        ? typeof fullValue === 'object' 
          ? JSON.stringify(fullValue, null, 2) 
          : String(fullValue)
        : normalizeNodeData(nodeData.text ?? []);
      setEditedContent(content);
      setOriginalContent(content);
    }
  }, [nodeData, opened]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    try {
      // Parse the edited content
      const newValue = parseEditedContent(editedContent);

      // Update the JSON in the store
      const currentJson = useJson.getState().json;
      const updatedJson = updateJsonAtPath(currentJson, nodeData?.path, newValue);
      
      // Update both useJson and useFile to keep them in sync
      useJson.getState().setJson(updatedJson);
      useFile.getState().setContents({ contents: updatedJson, hasChanges: true });

      // Update the graph visualization
      useGraph.getState().setGraph(updatedJson);

      setIsEditing(false);
      setOriginalContent(editedContent);
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("An error occurred while saving changes");
    }
  };

  const handleCancel = () => {
    setEditedContent(originalContent);
    setIsEditing(false);
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <CloseButton onClick={onClose} />
          </Flex>

          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={e => setEditedContent(e.currentTarget.value)}
              placeholder="Enter JSON content"
              minRows={4}
              maxRows={10}
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "12px",
                },
              }}
            />
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={editedContent}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>

        <Flex gap="sm" justify="flex-end" pt="sm">
          {isEditing ? (
            <>
              <Button variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit}>
              Edit
            </Button>
          )}
        </Flex>
      </Stack>
    </Modal>
  );
};
