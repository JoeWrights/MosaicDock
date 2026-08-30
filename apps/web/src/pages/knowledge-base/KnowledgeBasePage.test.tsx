import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeBasePage, type KnowledgeBasePageApi } from ".";

function createApi(): KnowledgeBasePageApi {
  return {
    client: {
      fetchKnowledgeBases: vi.fn(async () => ({
        items: [
          {
            id: "kb-1",
            name: "产品知识库",
            description: "沉淀产品需求和 FAQ",
            embeddingModelId: "embedding-1",
            userId: "user-1",
            chunkMaxSize: 1000,
            chunkOverlapSize: 100,
            chunkMinSize: 50,
            isPublic: false,
            createdAt: "2026-06-29T00:00:00.000Z",
            updatedAt: "2026-06-29T00:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
      fetchKnowledgeBaseFiles: vi.fn(async () => ({
        items: [
          {
            id: "folder-1",
            displayName: "需求文档",
            fileName: "需求文档",
            fileSize: 0,
            fileType: "directory",
            fileExtension: "",
            processingStatus: "completed",
            progressPercentage: 100,
            totalChunks: 0,
            knowledgeBaseId: "kb-1",
            isDirectory: true,
            parentFolderId: null,
            relativePath: "需求文档",
            uploadedAt: "2026-06-29T00:00:00.000Z",
          },
          {
            id: "file-1",
            displayName: "PRD.md",
            fileName: "prd.md",
            fileSize: 2048,
            fileType: "text/markdown",
            fileExtension: ".md",
            processingStatus: "failed",
            progressPercentage: 40,
            totalChunks: 3,
            knowledgeBaseId: "kb-1",
            isDirectory: false,
            parentFolderId: null,
            relativePath: "PRD.md",
            uploadedAt: "2026-06-29T00:00:00.000Z",
          },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      })),
      createKnowledgeBase: vi.fn(async (data) => ({
        id: "kb-2",
        name: data.name,
        description: data.description,
        embeddingModelId: data.embeddingModelId,
        userId: "user-1",
        chunkMaxSize: 1000,
        chunkOverlapSize: 100,
        chunkMinSize: 50,
        isPublic: false,
        createdAt: "2026-06-29T00:00:00.000Z",
        updatedAt: "2026-06-29T00:00:00.000Z",
      })),
      updateKnowledgeBase: vi.fn(async (_knowledgeBaseId, data) => ({
        id: "kb-1",
        name: data.name ?? "产品知识库",
        description: data.description ?? "沉淀产品需求和 FAQ",
        embeddingModelId: data.embeddingModelId ?? "embedding-1",
        userId: "user-1",
        chunkMaxSize: 1000,
        chunkOverlapSize: 100,
        chunkMinSize: 50,
        isPublic: false,
        createdAt: "2026-06-29T00:00:00.000Z",
        updatedAt: "2026-06-29T00:00:00.000Z",
      })),
      deleteKnowledgeBase: vi.fn(async () => ({ success: true })),
      uploadKnowledgeBaseFile: vi.fn(async (knowledgeBaseId, file) => ({
        id: "file-uploaded",
        displayName: file.name,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        processingStatus: "pending",
        progressPercentage: 0,
        totalChunks: 0,
        knowledgeBaseId,
        isDirectory: false,
        parentFolderId: null,
        relativePath: file.name,
        uploadedAt: "2026-06-29T00:00:00.000Z",
      })),
      createKnowledgeBaseFolder: vi.fn(async (knowledgeBaseId, data) => ({
        id: "folder-2",
        displayName: data.folderName,
        knowledgeBaseId,
        isDirectory: true,
        parentFolderId: data.parentFolderId,
        relativePath: data.folderName,
      })),
      renameKnowledgeBaseFile: vi.fn(async (_knowledgeBaseId, fileId, data) => ({
        id: fileId,
        knowledgeBaseId: "kb-1",
        displayName: data.newName,
        relativePath: data.newName,
      })),
      deleteKnowledgeBaseFile: vi.fn(async () => ({ success: true })),
      retryKnowledgeBaseFile: vi.fn(async () => ({ success: true })),
    },
  };
}

describe("KnowledgeBasePage", () => {
  it("renders guada-style knowledge base list and selected files", async () => {
    const api = createApi();

    render(<KnowledgeBasePage api={api} />);

    expect(await screen.findByRole("heading", { name: "知识库" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索知识库")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建知识库" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用说明" })).toBeInTheDocument();
    expect(await screen.findAllByText("产品知识库")).toHaveLength(2);
    expect(await screen.findByText("PRD.md")).toBeInTheDocument();
    expect(screen.getByText("处理失败")).toBeInTheDocument();
    expect(api.client.fetchKnowledgeBaseFiles).toHaveBeenCalledWith("kb-1", { skip: 0, limit: 50 });
  });

  it("creates, edits and deletes a knowledge base", async () => {
    const user = userEvent.setup();
    const api = createApi();

    render(<KnowledgeBasePage api={api} />);

    await user.click(await screen.findByRole("button", { name: "新建知识库" }));
    await user.type(screen.getByLabelText("知识库名称"), "客服知识库");
    await user.type(screen.getByLabelText("向量模型 ID"), "embedding-customer");
    await user.type(screen.getByLabelText("描述"), "客服常见问题");
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => {
      expect(api.client.createKnowledgeBase).toHaveBeenCalledWith({
        name: "客服知识库",
        description: "客服常见问题",
        embeddingModelId: "embedding-customer",
      });
    });
    expect(await screen.findAllByText("客服知识库")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "编辑知识库 产品知识库" }));
    await user.clear(screen.getByLabelText("知识库名称"));
    await user.type(screen.getByLabelText("知识库名称"), "产品中心知识库");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(api.client.updateKnowledgeBase).toHaveBeenCalledWith("kb-1", {
        name: "产品中心知识库",
        description: "沉淀产品需求和 FAQ",
        embeddingModelId: "embedding-1",
      });
    });

    await user.click(screen.getByRole("button", { name: "删除知识库 产品中心知识库" }));
    await user.click(screen.getByRole("button", { name: "确认删除知识库" }));

    await waitFor(() => {
      expect(api.client.deleteKnowledgeBase).toHaveBeenCalledWith("kb-1");
    });
  });

  it("manages knowledge base files", async () => {
    const user = userEvent.setup();
    const api = createApi();

    render(<KnowledgeBasePage api={api} />);

    await screen.findByText("PRD.md");
    const fileInput = screen.getByLabelText("上传文件");
    const uploadFile = new File(["hello"], "roadmap.md", { type: "text/markdown" });
    await user.upload(fileInput, uploadFile);

    await waitFor(() => {
      expect(api.client.uploadKnowledgeBaseFile).toHaveBeenCalledWith("kb-1", uploadFile);
    });

    await user.click(screen.getByRole("button", { name: "新建文件夹" }));
    await user.type(screen.getByLabelText("文件夹名称"), "发布资料");
    await user.click(screen.getByRole("button", { name: "创建文件夹" }));

    await waitFor(() => {
      expect(api.client.createKnowledgeBaseFolder).toHaveBeenCalledWith("kb-1", {
        folderName: "发布资料",
        parentFolderId: null,
      });
    });

    const fileRow = screen.getByRole("row", { name: /PRD.md/ });
    await user.click(within(fileRow).getByRole("button", { name: "重命名 PRD.md" }));
    await user.clear(screen.getByLabelText("新名称"));
    await user.type(screen.getByLabelText("新名称"), "新版 PRD.md");
    await user.click(screen.getByRole("button", { name: "保存名称" }));

    await waitFor(() => {
      expect(api.client.renameKnowledgeBaseFile).toHaveBeenCalledWith("kb-1", "file-1", {
        newName: "新版 PRD.md",
      });
    });

    const renamedFileRow = screen.getByRole("row", { name: /新版 PRD.md/ });
    await user.click(within(renamedFileRow).getByRole("button", { name: "重新处理 新版 PRD.md" }));
    await user.click(within(renamedFileRow).getByRole("button", { name: "删除 新版 PRD.md" }));
    await user.click(screen.getByRole("button", { name: "确认删除文件" }));

    await waitFor(() => {
      expect(api.client.retryKnowledgeBaseFile).toHaveBeenCalledWith("kb-1", "file-1");
      expect(api.client.deleteKnowledgeBaseFile).toHaveBeenCalledWith("kb-1", "file-1");
    });
  });
});
