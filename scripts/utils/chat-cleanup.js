const installedCollections = new WeakSet();
const DELETE_BATCH_SIZE = 10;
const DELETE_PAUSE_MS = 100;

/**
 * Delete documents in small batches with pauses, bounding each socket
 * response's synchronous document callbacks on every client. Core deletion
 * hooks and chat animations settle between batches.
 *
 * With `exists`, ids already deleted elsewhere (another module, user or
 * client) since the list was taken are skipped, so one stale id cannot fail
 * the whole batch. A batch that still hits "does not exist" is retried once
 * with the ids that remain.
 * @param {{deleteDocuments: Function}} documentClass
 * @param {string[]} ids
 * @param {{
 *   onProgress?: (deleted: number, total: number) => void,
 *   exists?: (id: string) => boolean,
 * }} [options]
 */
export async function deleteInBatches(
  documentClass,
  ids,
  { onProgress, exists } = {},
) {
  const alive = (batch) => (exists ? batch.filter(exists) : batch);
  for (let offset = 0; offset < ids.length; offset += DELETE_BATCH_SIZE) {
    const slice = ids.slice(offset, offset + DELETE_BATCH_SIZE);
    const batch = alive(slice);
    if (batch.length) {
      try {
        await documentClass.deleteDocuments(batch);
      } catch (error) {
        if (!exists || !/does not exist/i.test(error?.message ?? ""))
          throw error;
        const retry = alive(batch);
        if (retry.length) await documentClass.deleteDocuments(retry);
      }
    }
    onProgress?.(offset + slice.length, ids.length);
    if (offset + DELETE_BATCH_SIZE < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, DELETE_PAUSE_MS));
    }
  }
}

async function clearMessages(collection) {
  // Snapshot after confirmation. Messages posted during cleanup survive.
  const ids = [
    ...new Set([
      ...collection.contents.map((message) => message.id),
      ...(collection.invalidDocumentIds ?? []),
    ]),
  ];
  await deleteInBatches(collection.documentClass, ids);
  if (!collection.size) {
    for (const button of document.querySelectorAll(".jump-to-bottom")) {
      button.hidden = true;
    }
  }
}

/** Replace only the collection's clear-log entry point, retaining core's prompt. */
export function installChatCleanup(collection = game.messages) {
  if (
    !collection?.flush ||
    !collection.documentClass?.deleteDocuments ||
    !foundry.applications?.api?.DialogV2?.confirm ||
    installedCollections.has(collection)
  )
    return;

  let pending;
  collection.flush = function () {
    if (pending) return pending;
    pending = foundry.applications.api.DialogV2.confirm({
      window: { title: "CHAT.FlushTitle" },
      content: `<p><strong>${game.i18n.localize("COMMON.AreYouSure")}</strong> ${game.i18n.localize("CHAT.FlushWarning")}</p>`,
      position: {
        top: window.innerHeight - 150,
        left: window.innerWidth - 720,
      },
      yes: { callback: () => clearMessages(this) },
    }).finally(() => {
      pending = null;
    });
    return pending;
  };
  installedCollections.add(collection);
}
