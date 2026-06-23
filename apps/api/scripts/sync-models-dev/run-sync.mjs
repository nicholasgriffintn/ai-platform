import path from "node:path";
import { buildArtificialAnalysisLookup } from "./artificial-analysis.mjs";
import { inspectModelFile, listTsFiles, processFile } from "./model-file-processing.mjs";
import { fetchApiData, fetchArtificialAnalysisData } from "./remote-clients.mjs";

export async function runSyncModelsDev(options) {
	const remoteProviders = await fetchApiData(options.apiUrl);
	const artificialAnalysisModels = await fetchArtificialAnalysisData({
		apiUrl: options.polychatApiBaseUrl,
		apiKey: options.polychatApiKey,
	});
	const artificialAnalysisLookup = buildArtificialAnalysisLookup(artificialAnalysisModels);
	const files = (await listTsFiles(options.modelsDir))
		.filter((filePath) => path.basename(filePath) !== "index.ts")
		.sort((left, right) => left.localeCompare(right));

	const inspections = await Promise.all(
		files.map((filePath) =>
			inspectModelFile({
				filePath,
				remoteProviders,
				selectedProviders: options.providers,
			}),
		),
	);
	const providerRepresentedRemoteModelIds = new Map();
	const providerFileCounts = new Map();

	for (const inspection of inspections) {
		if (inspection.status !== "processable") {
			continue;
		}

		providerFileCounts.set(
			inspection.remoteProviderId,
			(providerFileCounts.get(inspection.remoteProviderId) ?? 0) + 1,
		);

		let representedRemoteModelIds = providerRepresentedRemoteModelIds.get(
			inspection.remoteProviderId,
		);
		if (!representedRemoteModelIds) {
			representedRemoteModelIds = new Set();
			providerRepresentedRemoteModelIds.set(inspection.remoteProviderId, representedRemoteModelIds);
		}

		for (const remoteModelId of inspection.representedRemoteModelIds) {
			representedRemoteModelIds.add(remoteModelId);
		}
	}

	const reports = [];
	for (const filePath of files) {
		const inspection = inspections.find((candidate) => candidate.filePath === filePath);
		const providerFileCount =
			inspection?.status === "processable"
				? (providerFileCounts.get(inspection.remoteProviderId) ?? 1)
				: 1;
		const report = await processFile({
			filePath,
			remoteProviders,
			artificialAnalysisLookup,
			write: options.write,
			selectedProviders: options.providers,
			verbose: options.verbose,
			providerRepresentedRemoteModelIds:
				inspection?.status === "processable"
					? providerRepresentedRemoteModelIds.get(inspection.remoteProviderId)
					: undefined,
			allowAddingMissingModels: providerFileCount === 1,
		});
		reports.push(report);
	}

	const changed = reports.filter((report) => report.status === "changed");
	const unchanged = reports.filter((report) => report.status === "unchanged");
	const skipped = reports.filter((report) => report.status === "skipped");

	const totalUpdatedExisting = changed.reduce((total, report) => {
		return total + (report.updatedExisting ?? 0);
	}, 0);

	const totalAddedModels = changed.reduce((total, report) => {
		return total + (report.addedModels ?? 0);
	}, 0);

	const totalUpdatedArtificialAnalysis = changed.reduce((total, report) => {
		return total + (report.updatedArtificialAnalysis ?? 0);
	}, 0);

	const totalRemovedDeprecatedModels = changed.reduce((total, report) => {
		return total + (report.removedDeprecatedModels ?? 0);
	}, 0);

	const totalRemovedDuplicateModels = changed.reduce((total, report) => {
		return total + (report.removedDuplicateModels ?? 0);
	}, 0);

	console.log(
		`Processed ${reports.length} files (${changed.length} changed, ${unchanged.length} unchanged, ${skipped.length} skipped).`,
	);
	console.log(
		`Updated existing models: ${totalUpdatedExisting}. Added new models: ${totalAddedModels}. Removed deprecated models: ${totalRemovedDeprecatedModels}. Removed duplicate models: ${totalRemovedDuplicateModels}.`,
	);
	if (options.polychatApiKey) {
		console.log(
			`Synced Artificial Analysis data for ${totalUpdatedArtificialAnalysis} models from ${artificialAnalysisModels.length} cached records.`,
		);
	}

	const stats = {
		processedFiles: reports.length,
		changedFiles: changed.length,
		unchangedFiles: unchanged.length,
		skippedFiles: skipped.length,
		updatedExistingModels: totalUpdatedExisting,
		updatedArtificialAnalysisModels: totalUpdatedArtificialAnalysis,
		addedModels: totalAddedModels,
		removedDeprecatedModels: totalRemovedDeprecatedModels,
		removedDuplicateModels: totalRemovedDuplicateModels,
	};

	if (!options.write) {
		console.log("Dry run only. Re-run with --write to apply changes.");
	}

	const splitProviders = [...providerFileCounts.entries()]
		.filter(([, fileCount]) => fileCount > 1)
		.map(([remoteProviderId]) => remoteProviderId)
		.sort((left, right) => left.localeCompare(right));

	if (splitProviders.length > 0) {
		console.log(`Skipped adding missing models for split providers: ${splitProviders.join(", ")}`);
	}

	const skippedProviders = skipped
		.filter((report) => report.reason === "remote-provider-missing")
		.map((report) => `${report.localProvider} -> ${report.remoteProviderId}`);

	if (skippedProviders.length > 0) {
		const uniqueSkippedProviders = [...new Set(skippedProviders)].sort((a, b) =>
			a.localeCompare(b),
		);
		console.log(`Providers without models.dev mapping: ${uniqueSkippedProviders.join(", ")}`);
	}

	return stats;
}
