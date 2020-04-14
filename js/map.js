function drawMap() {
  const urls = {
    basemap: "https://data.sfgov.org/resource/xfcw-9evu.geojson",
    //streets: "https://data.sfgov.org/resource/3psu-pn9h.geojson?$limit=20000",
    //arrests: "https://data.sfgov.org/resource/nwbb-fxkq.json"
    //basemap: "https://usc.data.socrata.com/resource/9utn-waje.geojson" //LA
  };

  // calculate date range
  const end = d3.timeDay.floor(d3.timeDay.offset(new Date(), -1));
  const start = d3.timeDay.floor(d3.timeDay.offset(end, -7));
  const format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");
  console.log(format(start), format(end));

  // add parameters to arrests url
  urls.arrests += "?$where=starts_with(resolution, 'Cite or Arrest')";
  urls.arrests += " AND incident_date between '" + format(start) + "'";
  urls.arrests += " and '" + format(end) + "'";
  urls.arrests += " AND point IS NOT NULL";

  // output url before encoding
  console.log(urls.arrests);

  // encode special characters
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI
  urls.arrests = encodeURI(urls.arrests);
  console.log(urls.arrests);

  const svg = d3.select("body").select("svg#vis");

  const g = {
    basemap: svg.select("g#basemap"),
    streets: svg.select("g#streets"),
    outline: svg.select("g#outline"),
    arrests: svg.select("g#arrests"),
    tooltip: svg.select("g#tooltip"),
    details: svg.select("g#details")
  };

  // setup tooltip (shows neighborhood name)
  const tip = g.tooltip.append("text").attr("id", "tooltip");
  tip.attr("text-anchor", "end");
  tip.attr("dx", -5);
  tip.attr("dy", -5);
  tip.style("visibility", "hidden");

  // add details widget
  // https://bl.ocks.org/mbostock/1424037
  const details = g.details.append("foreignObject")
    .attr("id", "details")
    .attr("width", 960)
    .attr("height", 600)
    .attr("x", 0)
    .attr("y", 0);

  const body = details.append("xhtml:body")
    .style("text-align", "left")
    .style("background", "none")
    .html("<p>N/A</p>");

  details.style("visibility", "hidden");

  // setup projection
  // https://github.com/d3/d3-geo#geoConicEqualArea
  const projection = d3.geoConicEqualArea();
  projection.parallels([37.692514, 37.840699]);
  projection.rotate([122, 0]);

  // setup path generator (note it is a GEO path, not a normal path)
  const path = d3.geoPath().projection(projection);

  d3.json(urls.basemap).then(function(json) {
    //d3.csv("twin_peaks/WA_Counties.csv").then(function(json) {
    // makes sure to adjust projection to fit all of our regions
    projection.fitSize([960, 600], json);

    // draw the land and neighborhood outlines
    drawBasemap(json);

    // now that projection has been set trigger loading the other files
    // note that the actual order these files are loaded may differ
    d3.json("data_movie/blocks.geojson").then(drawStreets);

    d3.csv("data_movie/film-locations-in-san-francisco_no_dups.csv").then(drawArrests);
    //  d3.json(urls.arrests).then(drawArrests);
  });

  function drawBasemap(json) {
    console.log("basemap", json);

    const basemap = g.basemap.selectAll("path.land")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "land");

    const outline = g.outline.selectAll("path.neighborhood")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "neighborhood")
      .each(function(d) {
        // save selection in data for interactivity
        // saves search time finding the right outline later
        d.properties.outline = this;
      });

    // add highlight
    /*basemap.on("mouseover.highlight", function(d) {
        d3.select(d.properties.outline).raise();
        //    console.log(d.properties);
        d3.select(d.properties.outline).classed("active", true);
      })
      .on("mouseout.highlight", function(d) {
        d3.select(d.properties.outline).classed("active", false);
      });

    // add tooltip
    basemap.on("mouseover.tooltip", function(d) {
        tip.text(d.properties.nhood);
        tip.style("visibility", "visible");
      })
      .on("mousemove.tooltip", function(d) {
        const coords = d3.mouse(g.basemap.node());
        tip.attr("x", coords[0]);
        tip.attr("y", coords[1]);
      })
      .on("mouseout.tooltip", function(d) {
        tip.style("visibility", "hidden");
      });*/
  }

  function drawStreets(json) {
    //console.log("streets", json);

    const streets = json.features;

    g.streets.selectAll("path.street")
      .data(streets)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "street");
  }

  function drawArrests(json) {
    console.log("arrests", json);

    let color = d3.scaleSequential(d3.interpolatePlasma)
      .domain([1915, 2019]);

    // loop through and add projected (x, y) coordinates
    // (just makes our d3 code a bit more simple later)
    json.forEach(function(d) {
      const latitude = parseFloat(d.Latitude);
      const longitude = parseFloat(d.Longitude);
      const pixels = projection([longitude, latitude]);
      d.x = pixels[0];
      d.y = pixels[1];
      d.year = d["Release Year"];
    });

    const symbols = g.arrests.selectAll("circle")
      .data(json)
      .enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 4)
      .attr("fill", d => color(d.year))
      .attr("class", "symbol");

    symbols.on("mouseover.hover", function(d) {
      d3.select(this).raise();
      d3.select(this).classed("active-small", true);

      let div = d3.select("body").append("div");

      div
        .attr("id", "details")
        .attr("class", "tooltip");

      let dataNew = createTooltip(Object(d));

      let rows = div
        .append("tablenew")
        .selectAll("tr")
        .data(Object.keys(dataNew))
        .enter()
        .append("tr");

      rows.append("th").text(key => key);
      rows.append("td").text(key => dataNew[key]);
      div.style("display", "inline");

      symbols.filter(e => (d.year !== e.year)).transition().style("fill", "#bbbbbb");
      symbols.filter(function(e) {
            return d.year == e.year;
        }).raise();

    });

    symbols.on("mousemove.hover", function(d) {
      let div = d3.select("div#details");
      let bbox = div.node().getBoundingClientRect();

      div.style("left", d3.event.pageX + "px");
      div.style("top", (d3.event.pageY - bbox.height) + "px");
    });

    symbols.on("mouseout.hover", function(d) {
      d3.select(this).classed("active-small", false);
      d3.selectAll("div#details").remove();
      symbols.transition().style("fill", d => color(d.type));
    });

  }

  function translate(x, y) {
    return "translate(" + String(x) + "," + String(y) + ")";
  }

  //function for a second tooltip
  function createTooltip(row, index) {

    let out = {};
    for (let col in row) {
      switch (col) {
        case 'Title':
          out['Title:\xa0'] = row[col];
          break;
        case 'Release Year':
          out['Release Year:\xa0'] = row[col];
          break;
        case 'Locations':
          out['Address:\xa0'] = row[col];
          break;
        case 'Director':
          out['Director:\xa0'] = row[col];
          break;
        case 'Actor 1':
          out['Actor 1:\xa0'] = row[col];
          break;
        case 'Actor 2':
          out['Actor 2:\xa0'] = row[col];
          break;
        case 'Actor 3':
          out['Actor 3:\xa0'] = row[col];
          break;

        default:
          break;
      }
    }
    return out;
  }

}
