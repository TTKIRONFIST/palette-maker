
const $ = require("jquery");

const ImageUtil = require("./image-util.js");
const PaletteTableWriter = require("./palette-table-writer.js");
const HistogramPaletteBuilder = require("./histogram-palette-builder.js");
const HistogramPalettePlotter = require("./histogram-palette-plotter.js");

// Check for the various File API support.
if (window.File && window.FileReader && window.FileList && window.Blob) {
} else {
  alert('The File APIs are not fully supported in this browser.');
}

var image = null;
var timerId;
function handleFileSelect(evt) {
  var file = evt.target.files[0];

  console.log("file is " + file);

  var start = 0;
  var stop = file.size - 1;

  var reader = new FileReader();

  reader.onload = (function(theFile) {
    return function(e) {
      image = document.getElementById('original-image');
      image.src = e.target.result;

      $("#source-image").show();
      $("#plot-content").show();

      $(".input-image-panel").hide();
      $("#input-image-plot").hide();

      $("#histogram-output").hide();
      $("#median-cut-output").hide();
      $("#kmeans-output").hide();
    };
  })(file);

  $("#original-image").attr("src","");
  timerId = setInterval(showImageIfPossible, 1000);
  reader.readAsDataURL(file);
}

function showImageIfPossible() {
  var imageSrc = document.getElementById("original-image").src;
  if(!_.isEmpty(imageSrc)) {
    clearInterval(timerId);
    run();
    plotOriginalData(pixels);
  } else {
    console.log("tick");
  }
}

var pixels = null;
function run(){
  var imgWidth = image.width;
  var imgHeight = image.height;
  var maxDimension = imgWidth > imgHeight ? imgWidth : imgHeight;

  var scale = maxDimension / 100;
  var canvasHeight = parseInt(imgHeight / scale);
  var canvasWidth = parseInt(imgWidth / scale);

  var canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.getContext('2d').drawImage(image, 0, 0, canvasWidth, canvasHeight);

  console.log("Canvas size: " + canvas.width + "x" + canvas.height);
  var pixelData = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
  console.log("pixel data: " + pixelData);

  pixels = [];
  for (var x=0; x < canvas.width; x++){
    for (var y=0; y < canvas.height; y++){
      var pixel = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
      pixels.push({
        red: pixel[0],
        green: pixel[1],
        blue: pixel[2]
      });
    }
  }

  console.log("read image, found " + pixels.length + " pixels");
}

function plotImage() {
  plotOriginalData(pixels);
}

// ========================================================================================
// =================================== Entry Functions ====================================
// ========================================================================================
function resetAlgorithmOutputs(){
  removePaletteTable("#histogram-palette");
  $("#histogram-output").hide();

  removePaletteTable("#median-cut-palette");
  $("#median-cut-output").hide();

  removePaletteTable("#kmeans-palette");
  $("#kmeans-output").hide();
}

function runHistogram() {
  removePaletteTable("#histogram-palette");
  $("#histogram-output").hide();
  var histogramInputValue = parseInt($("#histogram-input").val());

  let histogramPaletteBuilder = new HistogramPaletteBuilder();
  bucketedPixelInfos = histogramPaletteBuilder.binPixels(pixels, histogramInputValue);

  let histogramPalettePlotter = new HistogramPalettePlotter();
  histogramPalettePlotter.plot("histogram-plot", pixels, bucketedPixelInfos.buckets, bucketedPixelInfos.colors, histogramInputValue);

  var bucketsInPalette = _.take(bucketedPixelInfos.buckets, 10);
  PaletteTableWriter.drawPaletteTable("#histogram-palette", bucketsInPalette);

  $("#histogram-output").show();
}

function runMedianCut() {
  removePaletteTable("#median-cut-palette");
  $("#median-cut-output").hide();
  var medianCutInputValue = parseInt($("#median-cut-input").val());
  console.log("running median cut with input " + medianCutInputValue);
  medianCutAndPlot(pixels, medianCutInputValue);
}

function runKMeans(){
  removePaletteTable("#kmeans-palette");
  $("#kmeans-output").hide();
  var kMeansInputValue = parseInt($("#kmeans-input").val());
  console.log("running kmeans with input " + kMeansInputValue);
  kMeansAndPlot(pixels, kMeansInputValue, 100);
}

function removePaletteTable(containerId) {
  $(containerId).empty();
}


function plotOriginalData(pixels) {
  console.log("will plot " + pixels.length + " pixels");
  var colors = _.map(pixels, function(p, index){
    return "rgb(" + p.red + "," + p.green + "," + p.blue + ")";
  });

  var data = {
    x: _.map(pixels, function(p){ return p.red; }),
    y: _.map(pixels, function(p){ return p.green; }),
    z: _.map(pixels, function(p){ return p.blue; }),
    mode: 'markers',
    marker: {
      size: 3,
      color: colors,
      line: {
        color: 'rgb(100,100,100)',
        width: 1
      }
    },
    type: 'scatter3d'
  };

  var layout = {
    margin: { l:0, r:0, b: 0, t: 0 },
    scene: {
      xaxis: { title: "Red" },
      yaxis: { title: "Green"},
      zaxis: { title: "Blue"}
    }
  };

  Plotly.newPlot('input-image-plot', [data], layout);
  $("#input-image-plot").show();
  $(".input-image-panel").show();
}

function medianCutAndPlot(pixels, partitions) {
  var groupsWithInfo = {
    points: pixels,
    xMin: 0,
    xMax: 255,
    yMin: 0,
    yMax: 255,
    zMin: 0,
    zMax: 255
  };

  var result = medianCut([groupsWithInfo], [], 0, partitions);
  var groups = _.map(result.groups, function(g) {return g.points;});
  var cuts = result.cuts;

  console.log("=======================");
  _.each(groups, function(g){
    console.log("Cluster: " + g.length + " points");
  });
  /* plotClusters(groups, "median-cut-plot");
   */
  var data = _.map(groups, function(group){
    var avgColor = ImageUtil.computeAverageColor(group);
    var colorString = "rgb(" + parseInt(avgColor.red) + "," + parseInt(avgColor.green) + "," + parseInt(avgColor.blue) + ")";
    return {
      x: _.map(group, function(p){ return p.red; }),
      y: _.map(group, function(p){ return p.green; }),
      z: _.map(group, function(p){ return p.blue; }),
      mode: 'markers',
      marker: {
        color: colorString,
        size: 3,
        line: {
          color: 'rgb(100,100,100)',
          width: 1
        }
      },
      type: 'scatter3d'
    };
  });

  var layout = {
    margin: { l:0, r:0, b: 0, t: 0 },
    scene: {
      xaxis: { title: "Red" },
      yaxis: { title: "Green"},
      zaxis: { title: "Blue"}
    }
  };

  var meshes = _.map(cuts, function(cut) {
    var allX = _.map(cut, function(point) {
      return point.x;
    });
    var allY = _.map(cut, function(point) {
      return point.y;
    });
    var allZ = _.map(cut, function(point) {
      return point.z;
    });
    return {
      opacity:0.175,
      color:'rgb(100,100,100)',
      type: 'mesh3d',
      x: allX,
      y: allY,
      z: allZ,
      name: "grid"
    };
  });

  _.each(meshes, function(mesh) {
    data.push(mesh);
  });

  Plotly.newPlot("median-cut-plot", data, layout);
  PaletteTableWriter.drawPaletteTable("#median-cut-palette", groups);
  $("#median-cut-output").show();
}

// =======================================================
// ================== KMeans Start =======================
// =======================================================

function kMeansAndPlot(pixels, k, numRuns) {
  var bestResult = null;
  var bestError = Infinity;

  for(var attempt=0; attempt<numRuns; attempt++) {
    result = kMeans(pixels, k);
    if(result.error < bestError) {
      bestResult = result.groups;
      bestError = result.error;
    }
  }
  plotClusters(bestResult, "kmeans-plot");
  PaletteTableWriter.drawPaletteTable("#kmeans-palette", bestResult);
  $("#kmeans-output").show();
}

function kMeans(pixels, k) {
  // randomly initialize means
  var means = [];
  for(m=0; m<k; m++){
    var pixel = pixels[Math.floor(Math.random()*pixels.length)];
    means.push(pixel);
  }

  var done = false;
  var result = null;
  while(!done) {
    result = groupPointsByMeans(means, pixels);
    newMeans = computeMeans(result.groups);
    done = isDone(means, newMeans);
  }

  console.log("Finished KMeans, error is " + result.error);
  return {
    groups: result.groups,
    error: result.error
  };
}

function computeMeans(groups) {
  return _.map(groups, function(group) {
    var averageColor = ImageUtil.computeAverageColor(group);
    return [averageColor.red, averageColor.green, averageColor.blue];
  });
}

function isDone(meansA, meansB) {
  var result = true;
  _.each(meansA, function(mean) {
    result = result | _.includes(meansB, mean);
  });
  return result;
}

function groupPointsByMeans(means, points) {
  var totalError = 0;
  var groups = _.map(means, function(m) { return []; });

  _.each(points, function(point) {
    var bestGroupIndex;
    var bestGroupError = Infinity;
    _.each(means, function(mean, index) {
      var error = distance(point, mean);
      if (error < bestGroupError) {
        bestGroupError = error;
        bestGroupIndex = index;
      }
    });
    groups[bestGroupIndex].push(point);
    totalError += bestGroupError;
  });
  return {
    means: means,
    groups: groups,
    error: totalError
  };
}

function distance(pointA, pointB) {
  var squaredDiffs = _.map(pointA, function(dim, index) {
    var diff = pointA[index] - pointB[index];
    return diff * diff;
  });
  return Math.sqrt(_.sum(squaredDiffs));
}

// =======================================================
// ================== KMeans End =========================
// =======================================================

/* function computeAverageColor(points){
 *   var totalRed = _.chain(points)
 *         .map(function(p){ return p.red; })
 *         .sum()
 *         .value();
 *   var totalGreen = _.chain(points)
 *         .map(function(p){ return p.green; })
 *         .sum()
 *         .value();
 *   var totalBlue = _.chain(points)
 *         .map(function(p){ return p.blue; })
 *         .sum()
 *         .value();
 *   return {
 *     red: (totalRed / points.length),
 *     green: (totalGreen / points.length),
 *     blue: (totalBlue / points.length)
 *   };
 * }
 * */
function plotClusters(pointGroups, elementId){
  var data = _.map(pointGroups, function(group){
    var avgColor = ImageUtil.computeAverageColor(group);
    var colorString = "rgb(" + parseInt(avgColor.red) + "," + parseInt(avgColor.green) + "," + parseInt(avgColor.blue) + ")";
    return {
      x: _.map(group, function(p){ return p.red; }),
      y: _.map(group, function(p){ return p.green; }),
      z: _.map(group, function(p){ return p.blue; }),
      mode: 'markers',
      marker: {
        color: colorString,
        size: 3,
        line: {
          color: 'rgb(100,100,100)',
          width: 1
        }
      },
      type: 'scatter3d'
    };
  });

  var layout = {
    margin: { l:0, r:0, b: 0, t: 0 },
    scene: {
      xaxis: { title: "Red" },
      yaxis: { title: "Green"},
      zaxis: { title: "Blue"}
    }
  };

  Plotly.newPlot(elementId, data, layout);
}

function generateMeshForCut(xMin, xMax, yMin, yMax, zMin, zMax, dimensionToCut, cutLocation) {
  if (dimensionToCut === "x") {
    return [
      {x: cutLocation, y: yMin, z: zMin},
      {x: cutLocation+0.1, y: yMax, z: zMin},
      {x: cutLocation+0.2, y: yMax, z: zMax},
      {x: cutLocation+0.3, y: yMin, z: zMax}
    ];
  } else if (dimensionToCut === "y") {
    return [
      {x: xMin, y: cutLocation, z: zMin},
      {x: xMax, y: cutLocation+0.1, z: zMin},
      {x: xMax, y: cutLocation+0.2, z: zMax},
      {x: xMin, y: cutLocation+0.3, z: zMax}
    ];
  } else if (dimensionToCut === "z") {
    return [
      {x: xMin, y: yMin, z: cutLocation},
      {x: xMax, y: yMin, z: cutLocation+0.1},
      {x: xMax, y: yMax, z: cutLocation+0.2},
      {x: xMin, y: yMax, z: cutLocation+0.3}
    ];
  }
}

function medianCut(pointGroups, cuts, currentIteration, maxIterations){
  /* console.log("running medianCut with " + pointGroups.length + " groups");*/
  console.log("running medianCut iteration: " + currentIteration + " of " + maxIterations);
  if (currentIteration >= maxIterations) {
    return {
      groups: pointGroups,
      cuts: cuts
    };
  }

  // determine which group has the most variation in some dimension
  var groupToSplitInfo = determineGroupToSplit(pointGroups);

  console.log("will split based on " + groupToSplitInfo.name);
  result= splitGroup(groupToSplitInfo.group, groupToSplitInfo);
  var splitGroups = result.groups;
  var cut = result.cut;
  cuts.push(cut);

  _.pullAt(pointGroups, groupToSplitInfo.groupIndex);
  _.each(splitGroups, function(g) {
    pointGroups.push(g);
  });

  return medianCut(pointGroups, cuts, currentIteration + 1, maxIterations);
};

function splitGroup(group, splitInfo) {
  var sortedPoints = _.sortBy(group.points, function(p){
    return p[splitInfo.name];
  });
  var medianIndex = parseInt(sortedPoints.length / 2);
  var medianValue = sortedPoints[medianIndex][splitInfo.name];

  var groupA = {
    points: [],
    xMin: group.xMin,
    xMax: group.xMax,
    yMin: group.yMin,
    yMax: group.yMax,
    zMin: group.zMin,
    zMax: group.zMax
  };
  var groupB = {
    points: [],
    xMin: group.xMin,
    xMax: group.xMax,
    yMin: group.yMin,
    yMax: group.yMax,
    zMin: group.zMin,
    zMax: group.zMax
  };

  var cut = null
  if(splitInfo.splitDimension === "x"){
    groupA.xMax = medianValue;
    groupB.xMin = medianValue;
  } else if (splitInfo.splitDimension === "y") {
    groupB.yMin = medianValue;
    groupA.yMax = medianValue;
  } else if (splitInfo.splitDimension === "z") {
    groupB.zMin = medianValue;
    groupA.zMax = medianValue;
  }

  _.each(group.points, function(p){
    if (p[splitInfo.name] > medianValue){
      groupB.points.push(p);
    } else {
      groupA.points.push(p);
    }
  });

  cut = generateMeshForCut(group.xMin, group.xMax, group.yMin, group.yMax, group.zMin, group.zMax, splitInfo.splitDimension, medianValue);
  return {
    groups:[groupA, groupB],
    cut: cut
  }
};

function determineGroupToSplit(groups) {
  groupStats = _.map(groups, function(group, index){
    var reds = _.map(group.points, function(point){ return point.red; });
    var greens = _.map(group.points, function(point){ return point.green; });
    var blues = _.map(group.points, function(point){ return point.blue; });

    var sumRed = _.sum(reds);
    var sumGreen = _.sum(greens);
    var sumBlue = _.sum(blues);

    var avgRed = sumRed / reds.length;
    var avgGreen = sumGreen / greens.length;
    var avgBlue = sumBlue / blues.length;

    var stats = [];
    stats.push({
      groupIndex: index,
      group: groups[index],
      name: "red",
      splitDimension: "x",
      index: 0,
      range: _.max(reds) - _.min(reds),
      variance: _.chain(reds)
                 .map(function(red) {
                   return (red - avgRed) * (red - avgRed);
                 })
                 .sum()
                 .value()
    });
    stats.push({
      groupIndex: index,
      group: groups[index],
      name: "green",
      splitDimension: "y",
      index: 1,
      range: _.max(greens) - _.min(greens),
      variance: _.chain(greens)
                 .map(function(green) {
                   return (green - avgGreen) * (green - avgGreen);
                 })
                 .sum()
                 .value()
    });
    stats.push({
      groupIndex: index,
      group: groups[index],
      name: "blue",
      splitDimension: "z",
      index: 2,
      range: _.max(blues) - _.min(blues),
      variance: _.chain(blues)
                 .map(function(blue) {
                   return (blue - avgBlue) * (blue - avgBlue);
                 })
                 .sum()
                 .value()
    });

    return _.last(_.sortBy(stats, 'range'));
  });

  var groupToSplit = _.last(_.sortBy(groupStats, 'range'));
  return groupToSplit;
};

$(".plot-toggle-header").click(function() {
  $header = $(this);
  //getting the next element
  $content = $header.next();
  //open up the content needed - toggle the slide- if visible, slide up, if not slidedown.
  $content.slideToggle(300, function () {});
});


$(document).ready(function() {
  document.getElementById('file').addEventListener('change', handleFileSelect, false);

  $("#run-histogram").click(runHistogram);
  $("#run-median-cut").click(runMedianCut);
  $("#run-kmeans").click(runKMeans);
});
