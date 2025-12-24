// MOBILE-SAFE NDVI + NDBI CHANGE FOR JAIPUR (2014–2024)

// 1) Study area (small box)
var roi = ee.Geometry.Rectangle([75.75, 26.85, 75.85, 26.95]);
Map.centerObject(roi, 11);
Map.setOptions('TERRAIN');

// 2) Load Landsat 8 SR (surface reflectance)
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(roi)
  .filterDate('2014-01-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 20));

// 3) Cloud mask
function maskClouds(img) {
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0)
              .and(qa.bitwiseAnd(1 << 5).eq(0));
  return img.updateMask(mask);
}
var clean = landsat.map(maskClouds);

// 4) NDVI helpers and images  (use SR_B5, SR_B4)
function toNDVI(img) {
  return img.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
}

var ndvi14 = clean.filterDate('2014-01-01','2014-12-31')
  .map(toNDVI).median().clip(roi);

var ndvi24 = clean.filterDate('2024-01-01','2024-12-31')
  .map(toNDVI).median().clip(roi);

var ndviChange = ndvi24.subtract(ndvi14);

// 5) NDBI helpers and images (use SR_B6, SR_B5)
function toNDBI(img) {
  return img.normalizedDifference(['SR_B6','SR_B5']).rename('NDBI');
}

var ndbi14 = clean.filterDate('2014-01-01','2014-12-31')
  .map(toNDBI).median().clip(roi);

var ndbi24 = clean.filterDate('2024-01-01','2024-12-31')
  .map(toNDBI).median().clip(roi);

var ndbiChange = ndbi24.subtract(ndbi14);

// 6) Visualize change maps
Map.addLayer(
  ndviChange,
  {min:-0.4,max:0.4,palette:['red','white','green']},
  'NDVI Change (Red = loss, Green = gain)'
);

Map.addLayer(
  ndbiChange,
  {min:-0.2,max:0.2,palette:['green','white','red']},
  'NDBI Change (Red = new urban)'
);

// 7) Masks
var vegLoss  = ndviChange.lt(-0.2);
var urbanNew = ndbiChange.gt(0.1);

// 8) Area stats with lighter settings
var simpleRoi = roi.simplify(500);
var statScale = 120;

var vegLossKm2 = vegLoss.multiply(ee.Image.pixelArea()).divide(1e6)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: simpleRoi,
    scale: statScale,
    maxPixels: 5e7
  });

var urbanNewKm2 = urbanNew.multiply(ee.Image.pixelArea()).divide(1e6)
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: simpleRoi,
    scale: statScale,
    maxPixels: 5e7
  });

print('📊 JAIPUR (small ROI) 2014–2024:');
print('🌿 Vegetation loss (km²):', vegLossKm2);
print('🏗️ New urban (km²):',      urbanNewKm2);

// 9) NDVI time series (optional)
var years = ee.List.sequence(2014, 2024);

var ndviTs = ee.ImageCollection(
  years.map(function(y) {
    y = ee.Number(y);
    var start = ee.Date.fromYMD(y, 1, 1);
    var end   = ee.Date.fromYMD(y, 12, 31);
    var nd = clean.filterDate(start, end)
      .map(toNDVI).median()
      .clip(roi)
      .set('system:time_start', start.millis());
    return nd;
  })
);

var chart = ui.Chart.image.series({
  imageCollection: ndviTs.select('NDVI'),
  region: simpleRoi,
  reducer: ee.Reducer.mean(),
  scale: statScale
}).setOptions({
  title: '🌿 NDVI trend (small Jaipur ROI)',
  hAxis: {title: 'Year'},
  vAxis: {title: 'NDVI'},
  lineWidth: 3,
  pointSize: 4
});

print(chart);

print('✅ If any reduceRegion still errors, ignore stats and use the maps + chart.');
Export.image.toDrive({
  image: ndviChange,
  description: 'Jaipur_small_NDVI_Change',
  scale: statScale,
  region: simpleRoi,
  maxPixels: 5e7,
  fileFormat: 'GeoTIFF'
});

Export.image.toDrive({
  image: ndbiChange,
  description: 'Jaipur_small_NDBI_Change',
  scale: statScale,
  region: simpleRoi,
  maxPixels: 5e7,
  fileFormat: 'GeoTIFF'
});
