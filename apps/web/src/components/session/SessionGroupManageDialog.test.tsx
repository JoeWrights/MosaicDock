import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionGroupManageDialog, type SessionGroup } from "./SessionGroupManageDialog";

function createGroups(): SessionGroup[] {
  return [
    { id: "group-1", name: "研发任务", sortOrder: 0 },
    { id: "group-2", name: "客户项目", sortOrder: 1 },
  ];
}

function createApi() {
  return {
    createSessionGroup: vi.fn(async () => ({ id: "group-3", name: "设计任务", sortOrder: 2 })),
    updateSessionGroup: vi.fn(async () => ({ id: "group-1", name: "研发项目", sortOrder: 0 })),
    deleteSessionGroup: vi.fn(async () => ({ success: true })),
    reorderSessionGroups: vi.fn(async () => ({ success: true })),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("SessionGroupManageDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a session group and syncs the local list", async () => {
    const api = createApi();
    const onGroupsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionGroupManageDialog
        open
        groups={createGroups()}
        api={api}
        onClose={vi.fn()}
        onGroupsChange={onGroupsChange}
      />,
    );

    await user.type(screen.getByPlaceholderText("输入新分组名称"), "设计任务");
    await user.click(screen.getByRole("button", { name: "新建" }));

    await waitFor(() => {
      expect(api.createSessionGroup).toHaveBeenCalledWith({ name: "设计任务" });
      expect(onGroupsChange).toHaveBeenCalledWith([
        { id: "group-1", name: "研发任务", sortOrder: 0 },
        { id: "group-2", name: "客户项目", sortOrder: 1 },
        { id: "group-3", name: "设计任务", sortOrder: 2 },
      ]);
    });
    expect(screen.getByPlaceholderText("输入新分组名称")).toHaveValue("");
  });

  it("renames and deletes existing session groups", async () => {
    const api = createApi();
    const onGroupsChange = vi.fn();
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <SessionGroupManageDialog
        open
        groups={createGroups()}
        api={api}
        onClose={vi.fn()}
        onGroupsChange={onGroupsChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "重命名 研发任务" }));
    const editInput = screen.getByDisplayValue("研发任务");
    await user.clear(editInput);
    await user.type(editInput, "研发项目");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(api.updateSessionGroup).toHaveBeenCalledWith("group-1", { name: "研发项目" });
    });

    await user.click(screen.getByRole("button", { name: "删除 客户项目" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "删除分组" })).toBeInTheDocument();
    expect(
      screen.getByText('确定要删除分组 "客户项目" 吗？该分组下的会话将自动归入任务列表。'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog", { name: "删除分组" })).not.toBeInTheDocument();
    expect(api.deleteSessionGroup).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "删除 客户项目" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(api.deleteSessionGroup).toHaveBeenCalledWith("group-2");
      expect(onGroupsChange).toHaveBeenLastCalledWith([
        { id: "group-1", name: "研发项目", sortOrder: 0 },
      ]);
    });
    expect(screen.queryByRole("dialog", { name: "删除分组" })).not.toBeInTheDocument();
  });

  it("shows loading while deleting a session group", async () => {
    const deferred = createDeferred<{ success: boolean }>();
    const api = {
      ...createApi(),
      deleteSessionGroup: vi.fn(() => deferred.promise),
    };
    const onGroupsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionGroupManageDialog
        open
        groups={createGroups()}
        api={api}
        onClose={vi.fn()}
        onGroupsChange={onGroupsChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "删除 客户项目" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(screen.getByRole("button", { name: "删除中..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(api.deleteSessionGroup).toHaveBeenCalledWith("group-2");
    expect(screen.getByRole("dialog", { name: "删除分组" })).toBeInTheDocument();

    deferred.resolve({ success: true });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "删除分组" })).not.toBeInTheDocument();
      expect(onGroupsChange).toHaveBeenCalledWith([
        { id: "group-1", name: "研发任务", sortOrder: 0 },
      ]);
    });
  });

  it("reorders groups with up and down controls", async () => {
    const api = createApi();
    const onGroupsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionGroupManageDialog
        open
        groups={createGroups()}
        api={api}
        onClose={vi.fn()}
        onGroupsChange={onGroupsChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "上移 客户项目" }));

    await waitFor(() => {
      expect(api.reorderSessionGroups).toHaveBeenCalledWith(["group-2", "group-1"]);
      expect(onGroupsChange).toHaveBeenCalledWith([
        { id: "group-2", name: "客户项目", sortOrder: 0 },
        { id: "group-1", name: "研发任务", sortOrder: 1 },
      ]);
    });
  });
});
