import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SEARCH_URL = "https://api.panoramax.xyz/api/search";
const LICENCES = new Map([
  ["CC-BY-SA-4.0", "CC BY-SA 4.0"],
  ["CC-BY-4.0", "CC BY 4.0"],
  ["etalab-2.0", "Etalab Open Licence 2.0"],
  ["CC0-1.0", "CC0 1.0"],
]);
const PER_PLACE = 2;
const CANDIDATES_PER_PLACE = 4;
const SPAN = 0.06;
const MIN_SEQUENCE_PICTURES = 20;
const REVIEWED = new Set([
  "3103e90a-9e84-45d5-a7a3-a267a21abc33",
  "3738195b-0d96-4102-8015-cb05e9177eb8",
  "3d0f8cb6-ae46-4b76-9204-81e9c3eab21d",
  "b5ca160b-5045-45e9-97c7-32569fd4c3fe",
  "9602c41b-fab5-4db0-bd47-d0de6d339c15",
  "13f1a2d8-d2bb-4cbd-9e61-b0d7656c4e82",
  "37242853-ac5c-4583-ba4b-ec509cd63fca",
  "a8da1c43-27a0-475c-9436-5e2ff8cafb51",
  "f22d711c-93fa-437a-9f55-88e13dde2fee",
  "1380a5a6-f207-4004-97cb-8417115c137c",
  "1ead8ad8-f8e2-4d53-8ec8-561b915ea0a7",
  "40443075-bfbb-4373-9883-c80df91327bb",
  "3788544c-705e-4e7b-9b93-0efba94d6021",
  "905ce5a9-69d5-4946-9a98-c4b87fd1341a",
  "1905d873-5746-4348-adce-563db5102100",
  "2a324fd7-123f-4d2e-b43f-16c803da3b4f",
  "6dd6e699-1f14-4a0f-96e2-3d1818d83992",
  "2facf1f4-30fc-4264-aaef-f7ae6ca1bb04",
  "8a91018b-c246-42a8-b4c3-dcfdbe7986e3",
  "edb8368e-5f10-4101-8c9c-21006bf2435f",
  "641c95e3-9372-4bd6-8a19-ce3d30ed9de5",
  "2abd01c6-1b80-4d3f-9c47-b25cec0088da",
  "8c874501-0e7a-4ec2-8d43-8dcacd87518b",
  "37d10fbf-eff9-4388-a0e5-67b6bcf778d8",
  "3f123a8b-22c6-418f-ac41-8b48211f4322",
  "c12294f8-a002-42eb-9f3f-b8b7322de895",
  "dfd4eda0-5b8b-4c24-b509-b141f67a8b0d",
  "e00de6ce-a5ff-4fea-b01c-b8d7faa51c96",
  "3f3914a8-b99d-4735-8e3e-dd0986f1dd40",
  "48347db1-ec21-483d-bb73-2f926c1df7ff",
  "7839432e-1376-448f-b9f2-86b2e7687b7b",
  "60200a7f-26a7-4c20-bbec-efb9a9ac37da",
  "81c31965-6986-48ea-8aaf-034b2627baea",
  "467d3e02-d9c7-411c-ab68-74c01e41f80d",
  "7e3047b1-b7d3-44f8-9c54-6f3f9c091e29",
  "595b618a-0944-493e-8eeb-9d9a248b417b",
  "59a48243-33d6-49f9-93d1-83fab0e7a568",
  "a355e1dd-288b-45fd-a3ba-e99b6d5b70f2",
  "887c809e-5a3c-4eee-a171-dbe5cd09aece",
  "8d527ed2-a503-4d65-8888-d6eee50c74ac",
  "bcadd81c-0d4d-4471-bd7f-9a422788dea7",
  "056fcc27-c058-408d-b38f-3976dc9a13fe",
  "5dda3d7e-31a4-43f3-bd94-07f3144e608c",
  "7cdd2faa-abfa-4a69-bfa3-791123206e60",
  "8525aabe-b179-471c-a386-6343dcad0100",
  "b808546c-dbe9-4c25-8950-70da095d73a3",
  "d720ed00-c4c2-4f1e-a4e4-888d69444ddb",
  "b422df60-66e9-4be7-8c15-d0127a2f140e",
  "e3cc9924-b762-47a1-a7c7-c9edad98b111",
  "557a38bd-2e0a-4723-b864-7f18b3b5887b",
  "08fb19a0-e0a5-4ed6-b9d1-a52ed4dfb5f1",
  "2d65db69-973f-4ef0-8283-f32b97b1116f",
  "88447ef6-6307-4e37-9b2a-a0f152e0703e",
  "ad16b4be-6604-430c-ab99-f68e0c125cf5",
  "654a60c8-00ad-41d9-8749-ecd3e6400b15",
  "7428bbf0-519f-44f8-a558-c8c7c7d7e727",
  "9e69348d-4d31-4a08-acd9-671b29bc0a33",
  "42eb9887-723b-4a26-82f1-6c95c9397ffc",
  "aa98a616-f82a-4713-92f4-6f6c5c1f892e",
  "2f6a620c-11ff-4550-b0aa-bb4ce4bd32b7",
  "9237e0b9-1c84-4f5f-baae-78a93203c363",
  "0c3f5d61-a6dc-44ef-b16c-0564a3418d2e",
  "11c3f55d-1f6d-488a-a118-481811f2ce8e",
  "bfc59d15-2f53-4b00-a16d-994f9db7501c",
  "615a3fc5-edab-4613-9995-9dcfb92592a7",
  "6066b77c-65ce-4f60-b4b3-1a016c2438c6",
  "6ae99be5-0abd-4b4d-a585-a2ccf85b457e",
  "dc87e254-d41d-4e41-bebd-eb640e5fe46e",
  "ee1f72a6-53d7-43ec-9a36-7472c326beda",
  "a84ee295-9620-4d8b-97f1-51c4adf67206",
  "b9ca46a2-3f65-4048-aad7-e9de84bbb6c0",
  "0d227339-d0b9-40b3-99ad-2072d314591d",
  "a9f7d4ea-b2cc-467f-b381-d72af641d6a1",
  "6d00cd56-d073-418c-a11f-9e637dfd3f5f",
  "4ac0c1f9-71dc-430e-bcb7-9f393eaae48f",
  "4e18f9ca-d1ec-49b6-9804-5473739fb946",
  "8260b653-4610-4648-a13a-ced1aa020158",
  "86af08e9-20d7-4074-89fc-beb498a98e84",
  "8cef1c4b-dad0-4577-872b-38dfbf3172c5",
  "df3ee2b7-150c-484d-a4a6-fadd03785eee",
  "27e453ae-1d31-4122-aed6-5b17b5f1cc9c",
  "87439b5f-7be3-4493-83cb-0f87594adf46",
  "272ff0c0-977d-415c-b9e3-4a5d494edbf5",
  "50e63bba-6048-422e-bf18-9b05583ef46a",
  "35986387-3423-4697-a05c-347614cf7175",
  "682d8ce2-03ee-4edf-9d08-3002aaa4e6ed",
  "d8aa04da-0717-46a1-b053-00980ee8c66e",
  "69021d34-2707-4f2c-8ec9-af7d162efc9f",
  "90833027-e390-4796-8e2a-d878eecacd9a",
  "9e4c1f14-d0b6-48d7-a775-bb19e7bccb15",
  "aab49e30-78fd-4739-a60d-e25cbe83b72e",
  "d5440633-c5a5-4636-8193-abba9b729de3",
  "840f33e7-f27f-40f1-b464-6eda8657478c",
  "dc7858d2-b3f1-4a9f-a8dd-14ffba5454b9",
  "3c215f1c-5429-4fc5-a534-60aec2888ecf",
  "551e3eee-d0c1-41fa-9195-df70f5f7c3a3",
  "0ac7fff1-737a-4be3-bfc0-11321b2ce014",
  "1737bd9a-6820-495c-b9ca-4e0047b76df2",
  "50c6063f-0189-4259-b73e-a8a2adccb605",
  "1c0cb5e3-3c7c-48f4-9463-3c337fb5b5fa",
  "018c1ae8-cd04-462e-9528-df33568de721",
  "418d8d98-54a9-444f-83ff-317cd23e225d",
  "bfb7cb8e-a1d6-41e6-a30a-467482955721",
  "466c942d-faa5-4859-bc5b-80b5cfd9d935",
  "43e31a4c-92f6-4769-a920-abdb2782cb7f",
  "81681986-d37b-4bc0-a46c-ae153beb128d",
  "5f5558f3-8e65-4c80-8857-795ea76c3932",
  "256e7f39-f3ec-4439-a8a8-07ca1aa8d045",
  "42dbc54f-6149-47c0-8813-a5769da5eb5e",
  "b2692dc6-ed50-4f22-84d7-2c695adcffb8",
  "c655ca3a-ee35-477d-ae22-81e90cf432bb",
  "35b42087-b6d3-4d0b-810c-893f18468bdc",
  "7660f9fa-52de-42f9-a9cd-486380dc2f6c",
  "e40c74d3-b5d8-46f6-ad80-827d5d3554ea",
  "48a300d9-5f22-4bbd-b38b-b1179542b5f3",
  "4c25f28d-0c07-4a6d-9ae3-5f9e8b3133d8",
  "d732df2c-b0c1-4521-95dc-de06d32499fd",
  "c99489db-d070-4e97-9f78-c74b319b878a",
  "cd4bc0b8-5302-408b-b889-49a3280e0565",
  "941ae8d9-8f47-4f20-9fab-1c71c6dd5882",
  "b648f7b3-d8f5-45eb-a9f0-77585d261864",
  "766bd2e7-56d8-4571-b0ab-848211ddf3e5",
  "19b666bd-0d20-43d6-a361-41d6b9b0853b",
  "2c5e9ebc-d25b-4a6b-bf40-0fe5983cc6fe",
]);

const PLACES = [
  ["Lisbon", "PT", 38.722, -9.139],
  ["Madrid", "ES", 40.416, -3.703],
  ["Barcelona", "ES", 41.387, 2.17],
  ["Lyon", "FR", 45.764, 4.835],
  ["Marseille", "FR", 43.296, 5.37],
  ["Brussels", "BE", 50.846, 4.352],
  ["Amsterdam", "NL", 52.37, 4.895],
  ["Berlin", "DE", 52.52, 13.405],
  ["Munich", "DE", 48.137, 11.575],
  ["Copenhagen", "DK", 55.676, 12.568],
  ["Stockholm", "SE", 59.329, 18.068],
  ["Helsinki", "FI", 60.169, 24.938],
  ["Oslo", "NO", 59.913, 10.752],
  ["Warsaw", "PL", 52.229, 21.012],
  ["Prague", "CZ", 50.075, 14.437],
  ["Vienna", "AT", 48.208, 16.373],
  ["Budapest", "HU", 47.497, 19.04],
  ["Zurich", "CH", 47.376, 8.541],
  ["Rome", "IT", 41.902, 12.496],
  ["Milan", "IT", 45.464, 9.19],
  ["Athens", "GR", 37.983, 23.727],
  ["Istanbul", "TR", 41.008, 28.978],
  ["Dublin", "IE", 53.349, -6.26],
  ["Edinburgh", "GB", 55.953, -3.188],
  ["Reykjavik", "IS", 64.146, -21.942],
  ["Tallinn", "EE", 59.437, 24.754],
  ["Kyiv", "UA", 50.45, 30.523],
  ["Tbilisi", "GE", 41.716, 44.783],
  ["New York", "US", 40.73, -73.98],
  ["San Francisco", "US", 37.774, -122.419],
  ["Montreal", "CA", 45.502, -73.567],
  ["Vancouver", "CA", 49.283, -123.121],
  ["Mexico City", "MX", 19.42, -99.15],
  ["Bogotá", "CO", 4.711, -74.072],
  ["Lima", "PE", -12.046, -77.043],
  ["Santiago", "CL", -33.449, -70.669],
  ["São Paulo", "BR", -23.55, -46.633],
  ["Montevideo", "UY", -34.901, -56.164],
  ["Nairobi", "KE", -1.29, 36.82],
  ["Dakar", "SN", 14.716, -17.467],
  ["Casablanca", "MA", 33.573, -7.589],
  ["Tunis", "TN", 36.806, 10.181],
  ["Johannesburg", "ZA", -26.204, 28.047],
  ["Tokyo", "JP", 35.67, 139.72],
  ["Osaka", "JP", 34.694, 135.502],
  ["Seoul", "KR", 37.566, 126.978],
  ["Taipei", "TW", 25.033, 121.565],
  ["Bangkok", "TH", 13.75, 100.52],
  ["Singapore", "SG", 1.29, 103.85],
  ["Kuala Lumpur", "MY", 3.139, 101.687],
  ["Jakarta", "ID", -6.2, 106.817],
  ["Manila", "PH", 14.599, 120.984],
  ["Mumbai", "IN", 19.076, 72.878],
  ["Sydney", "AU", -33.87, 151.2],
  ["Melbourne", "AU", -37.814, 144.963],
  ["Auckland", "NZ", -36.848, 174.763],
  ["Porto", "PT", 41.157, -8.629],
  ["Seville", "ES", 37.389, -5.984],
  ["Bordeaux", "FR", 44.837, -0.579],
  ["Kraków", "PL", 50.064, 19.945],
  ["Riga", "LV", 56.949, 24.105],
  ["Vilnius", "LT", 54.687, 25.279],
  ["Ljubljana", "SI", 46.056, 14.505],
  ["Zagreb", "HR", 45.815, 15.982],
  ["Bucharest", "RO", 44.426, 26.102],
  ["Sofia", "BG", 42.698, 23.322],
  ["Belgrade", "RS", 44.787, 20.457],
  ["Chicago", "US", 41.878, -87.63],
  ["Seattle", "US", 47.606, -122.332],
  ["Toronto", "CA", 43.653, -79.383],
  ["Quito", "EC", -0.18, -78.467],
  ["Havana", "CU", 23.113, -82.366],
  ["Accra", "GH", 5.603, -0.187],
  ["Addis Ababa", "ET", 9.03, 38.74],
  ["Kampala", "UG", 0.347, 32.582],
  ["Hanoi", "VN", 21.028, 105.854],
  ["Hong Kong", "HK", 22.302, 114.177],
  ["Delhi", "IN", 28.613, 77.209],
  ["Kyoto", "JP", 35.011, 135.768],
  ["Brisbane", "AU", -27.47, 153.026],
  ["Wellington", "NZ", -41.286, 174.776],
];

function isFlatPicture(feature) {
  const exif = JSON.stringify(feature.properties?.exif ?? {});
  const fieldOfView = feature.properties?.["pers:interior_orientation"]?.field_of_view;

  return !exif.includes("equirectangular") && fieldOfView !== 360;
}

function credit(feature) {
  const name = feature.providers?.find((provider) => provider.roles?.includes("producer"))?.name;

  return name && !name.includes("@") ? name : "Panoramax contributor";
}

async function search(lat, lng) {
  const bbox = [lng - SPAN, lat - SPAN, lng + SPAN, lat + SPAN].join(",");
  const response = await fetch(`${SEARCH_URL}?bbox=${bbox}&limit=200`);

  if (!response.ok) {
    return [];
  }

  return (await response.json()).features ?? [];
}

async function isStreetSequence(collectionId) {
  const response = await fetch(`https://api.panoramax.xyz/api/collections/${collectionId}`);

  if (!response.ok) {
    return false;
  }

  return ((await response.json())["stats:items"]?.count ?? 0) >= MIN_SEQUENCE_PICTURES;
}

async function pick(features) {
  const byCollection = new Map();

  for (const feature of features) {
    const licence = LICENCES.get(feature.properties?.license);

    if (!licence || !isFlatPicture(feature) || !feature.assets?.sd?.href) {
      continue;
    }

    if (!byCollection.has(feature.collection)) {
      byCollection.set(feature.collection, feature);
    }
  }

  const chosen = [];

  for (const feature of [...byCollection.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (chosen.length >= CANDIDATES_PER_PLACE) {
      break;
    }

    if (await isStreetSequence(feature.collection)) {
      chosen.push(feature);
    }
  }

  return chosen;
}

function toPhoto(feature, place, country) {
  const [longitude, latitude] = feature.geometry.coordinates;

  return {
    pictureId: feature.id,
    place,
    country,
    lat: Number(latitude.toFixed(5)),
    lng: Number(longitude.toFixed(5)),
    imageUrl: feature.assets.sd.href,
    author: credit(feature),
    licence: LICENCES.get(feature.properties.license),
    sourceUrl: `https://api.panoramax.xyz/#focus=pic&pic=${feature.id}`,
  };
}

const photos = [];
const candidates = [];

for (const [place, country, lat, lng] of PLACES) {
  const found = (await pick(await search(lat, lng))).map((feature) =>
    toPhoto(feature, place, country),
  );

  candidates.push(...found);
  photos.push(...found.filter((photo) => REVIEWED.has(photo.pictureId)).slice(0, PER_PLACE));
}

const output = fileURLToPath(new URL("../src/data/geoguess-photos.ts", import.meta.url));
const candidatesOutput = process.argv[2];

await writeFile(
  output,
  `import type { GeoguessPhoto } from "../definitions/geoguess-types.js";\n\nexport const GEOGUESS_PHOTOS: readonly GeoguessPhoto[] = ${JSON.stringify(photos, null, 2)};\n`,
);

if (candidatesOutput) {
  await writeFile(candidatesOutput, `${JSON.stringify(candidates, null, 2)}\n`);
}

console.log(`Wrote ${photos.length} reviewed photos from ${candidates.length} candidates`);
