function drawMap() {
  const urls = {
    basemap: "https://data.sfgov.org/resource/6ia5-2f8k.geojson", //SF Find Neighborhoods
    //  streets: "https://data.sfgov.org/resource/3psu-pn9h.geojson?$limit=15000",
    //  cases: "https://data.sfgov.org/resource/vw6y-z8j6.geojson"
  };

  // configuration of svg/plot area
  let config = {
    'svg': {},
    'margin': {},
    'plot': {}
  };

  let width = 960;
  let height = 500;

  // calculate date range
  const end = d3.timeDay.floor(d3.timeDay.offset(new Date(), -28));
  const start = d3.timeDay.floor(d3.timeDay.offset(end, -28));
  const format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");

  const svg = d3.select("body").select("svg#vis")
    .attr("style", "outline: thin solid lightgrey;");
  // setup plot area
  let plot = svg.select("g#plot")
  plot.attr('id', 'plot');
  plot.style("background", "blue");
  plot.attr('transform', translate(80, 10));

  const g = {
    basemap: plot.select("g#basemap"),
    streets: plot.select("g#streets"),
    outline: plot.select("g#outline"),
    movies: plot.select("g#movies"),
    details: plot.select("g#details"),
    tooltip: plot.select("g#tooltip"),
    legend: plot.select("g#legend"),
  };

  const details = g.details.append("foreignObject")
    .attr("id", "details")
    .attr("width", 960)
    .attr("height", 500)
    .attr("x", 0)
    .attr("y", 0);

  const tooltip = g.tooltip.append("foreignObject")
    .attr("id", "tooltip")
    .attr("width", 960)
    .attr("height", 500)
    .attr("x", 0)
    .attr("y", 0);

  const body = details.append("xhtml:body")
    .style("text-align", "left")
    .style("background", "none")
    .html("<p>N/A</p>");

  details.style("visibility", "hidden");

  const projection = d3.geoConicEqualArea();
  projection.parallels([37.692514, 37.840699]);
  projection.rotate([122, 0]);
  const path = d3.geoPath().projection(projection);

  d3.json(urls.basemap).then(function(json) {
    projection.fitSize([900, 500], json);
    drawBasemap(json);

    d3.json("data_movie/blocks.geojson").then(drawStreets);
    d3.csv("data_movie/film-locations-in-san-francisco_no_dups.csv").then(function(d) {
      drawMovies(d);
      drawBarChart(d);
    });

    drawLegend();
  });

  function drawBasemap(json) {

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
        d.properties.outline = this;
        d.properties.centroid = path.centroid(d);
      });

    let zoomTrans = {
      x: 0,
      y: 0,
      scale: 1
    }

    //mouse up
    //use the scale to decide on symbols small/large
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", () => {
        zoomTrans.scale = d3.event.transform.k;
        console.log(zoomTrans.scale);
        let circles = g.movies.selectAll("circle");
        if (zoomTrans.scale < 2.3) {
          circles.attr("r", 4 / zoomTrans.scale);
        } else if (zoomTrans.scale > 5) {
          circles.attr("r", 1.5);
        } else {
          circles.attr("r", 2);
        }
        zoomed();
      });

    plot.call(zoom);


    // add highlight
    basemap.on("mouseover.highlight", function(d) {
        d3.select(d.properties.outline).raise();
        d3.select(d.properties.outline).classed("activeland", true);
      })
      .on("mouseout.highlight", function(d) {
        d3.select(d.properties.outline).classed("activeland", false);
      });
  }

  function zoomed() {
    d3.select("body").select("g#plot")
      .attr('transform', d3.event.transform);
  }

  function drawStreets(json) {
    console.log("streets", json);

    const streets = json.features.filter(function(d) {
      return d;
    });

    g.streets.selectAll("path.street")
      .data(streets)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "street");
  }

  function drawMovies(json) {

    let color = d3.scaleSequential(d3.interpolateViridis) //interpolatePlasma)
      .domain([1915, 2019]);

    // loop through and add projected (x, y) coordinates
    // (just makes our d3 code a bit more simple later)
    json.forEach(function(d) {
      const latitude = parseFloat(d.Latitude);
      const longitude = parseFloat(d.Longitude);
      const pixels = projection([longitude, latitude]);
      d.x = pixels[0];
      d.y = pixels[1];
      d.year = parseInt(d["Release Year"]);
    });

    createSlider(json);

    const symbols = g.movies.selectAll("circle")
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
      d3.select(this).style("stroke", "black");
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
    });

    symbols.on("mousemove.hover", function(d) {
      let div = d3.select("div#details");
      let bbox = div.node().getBoundingClientRect();

      div.style("left", d3.event.pageX + "px");
      div.style("top", (d3.event.pageY - bbox.height) + "px");
    });

    symbols.on("mouseout.hover", function(d) {
      d3.select(this).classed("active-small", false);
      d3.select(this).style("stroke", "");
      d3.selectAll("div#details").remove();
      //symbols.transition().style("fill", d => color(d.type));
    });
  }

  function translate(x, y) {
    return "translate(" + String(x) + "," + String(y) + ")";
  }

  //function to make tooltip look better
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

        default:
          break;
      }
    }
    return out;
  }

  function updateMap(years) {

    let startYear = years[0];
    let endYear = years[1];
    const symbols = g.movies.selectAll("circle")

    symbols.filter(d => (d.year > endYear || d.year < startYear)).transition().style("display", "none");
    symbols.filter(d => (d.year <= endYear && d.year >= startYear)).raise().transition().style("display", "inline");
  }

  function createSlider(data) {

    let years = new Set(data.map(row => row.year))
    let minYear = 2020;
    let maxYear = 0;

    years.forEach(function(d) {
      if (d < minYear) {
        minYear = d;
      }
      if (d > maxYear) {
        maxYear = d;
      }
    });

    //adding years slider
    var sliderRange = d3
      .sliderBottom()
      .min(minYear)
      .max(maxYear)
      .step(1)
      .width(500)
      .tickValues(years)
      .default([1915, 2020])
      .fill('#2196f3')
      .on('onchange', value => {
        d3.select('p#value-simple').text(value.join('-'));
        updateMap(value);
      });

    var gTime = d3
      .select('div#slider-simple')
      .append('svg')
      .attr('width', 550)
      .attr('height', 100)
      .append('g')
      .attr('transform', 'translate(30,30)');

    gTime.call(sliderRange);

    d3.select('p#value-simple').text(
      sliderRange.value()
      .join('-')
    );
  }

  function drawLegend() {
    //create legend
    svg.append("g").attr("id", "legend");
    let legend = d3.select("svg#vis").select("g#legend");
    let legendColor = d3.scaleSequential(d3.interpolateViridis)
      .domain([1915, 2019]);

    const defs = svg.append("defs");

    const linearGradient = defs.append("linearGradient")
      .attr("id", "linear-gradient");

    linearGradient.selectAll("stop")
      .data(legendColor.ticks().map((t, i, n) => ({
        offset: `${100*i/n.length}%`,
        color: legendColor(t)
      })))
      .enter().append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    svg
      .append('g')
      .attr("transform", translate(450, 10))
      .append("rect")
      .attr('transform', translate(380, 0))
      .attr("width", 100)
      .attr("height", 10)
      .style("fill", "url(#linear-gradient)");

    // legend
    //   .append("text")
    //   .attr("class", "legend-text")
    //   .attr("x", width - 60)
    //   .attr("y", 128)
    //   .text("# of Incidents")
    //   .attr("alignment-baseline", "middle")
    //   .style('fill', 'white');
  }

//http://codexe.net/d3/d3-brush-zoom-bar-chart.html

  function drawBarChart(data) {
    // configuration of svg/plot area
    let config = {
      'svg': {},
      'margin': {},
      'plot': {}
    };

    let width = 960;
    let height = 500;

    const svg = d3.select("body").select("svg#barchart")
      .attr("style", "outline: thin solid lightgrey;");
    // setup plot area

    const plot = svg.append("g")
    plot.attr('id', 'plot');
    plot.style("background", "grey");
    plot.attr('transform', translate(40, 40));

    console.log(data);

    data.forEach(function(d) {
      d.year = d["Release Year"];
    })

    let merged = Object.values(data.reduce((r, o) => {
      r[o.year] = r[o.year] || {
        year: o.year,
        count: 0
      };
      r[o.year].count += 1;
      return r;
    }, {}));

    console.log("merged", merged);
    let max = 0;
    merged.forEach(function(d) {
      if (d.count > max) {
        max = d.count;
      }
    });


    console.log(max);

    let y = d3.scaleLinear()
      .domain([0, max])
      .range([height - 80, 0]);

    let years = merged.map(d => d.year);
    years.sort()
    let x = d3.scaleBand()
      .domain(years) // all region (not using the count here)
      .rangeRound([0, width-60])
      .paddingInner(0.60) // space between bars


    let xAxis = d3.axisBottom(x);
    let yAxis = d3.axisLeft(y);


    let xGroup = plot.append("g").attr("id", "x-axis");
    xGroup.call(xAxis).selectAll("text").attr('transform', 'rotate(80 -10 10)')
    xGroup.attr("transform", translate(0, height - 80));

    let yGroup = plot.append("g").attr("id", "y-axis");
    yGroup.call(yAxis);

    let bars = svg.selectAll(".bar")
    .data(merged)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", function(d) {
      return x(d.year) + 25;
    })
    .attr("width", x.bandwidth() + 5)
    .attr("y", function(d) {
      return y(d.count) + 30;
    })
    .attr("height", function(d) {
      return height - 70 - y(d.count);
    });




  }


}
