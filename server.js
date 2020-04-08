'use strict'

require('dotenv').config();
const express = require('express');
const pg = require('pg');
const cors = require('cors');
const superagent = require('superagent');

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());


app.get('/', (request, response) => {
    response.send('Home Page!');
});

// Route Definitions
app.get('/location', locationHandler);
// app.get('/weather', weatherHandler);
// app.get('/trails', trailsHandler);


//make a new connection to the psql(DB) using the provided link by using the client method(from pg library)
const client = new pg.Client(process.env.DATABASE_URL);
client.on('error', (err) => {
    throw new Error(err);
});

function locationHandler(request, response) {

    const city = request.query.city;
    const SQL = 'SELECT FROM locations WHERE search_query = ${city};';

    client
        .query(SQL)
        .then((results) => {
            res.status(200).json(results.rows);
        })
        .catch((err) => {
            res.status(500).send(err);
        });
});


const city = request.query.city;
superagent(
        `https://eu1.locationiq.com/v1/search.php?key=${process.env.GEOCODE_API_KEY}&q=${city}&format=json`
    )
    .then((res) => {
        const geoData = res.body;
        const locationData = new Location(city, geoData);
        response.status(200).json(locationData);
    })
    .catch((err) => errorHandler(err, request, response));
}

function Location(city, geoData) {
    this.search_query = city;
    this.formatted_query = geoData[0].display_name;
    this.latitude = geoData[0].lat;
    this.longitude = geoData[0].lon;
}

//get data from the query and insert it to the DB
app.get('/add', (req, res) => {
    let search_query = req.query.search_query;
    let formatted_query = req.query.formatted_query;
    let latitude = req.query.latitude;
    let longitude = req.query.longitude;

    const SQL = 'INSERT INTO locations(search_query,formatted_query,latitude,longitude) VALUES ($1,$2,$3,$4) RETURNING * ';
    const safeValues = [search_query, formatted_query, latitude, longitude];
    client
        .query(SQL, safeValues)
        .then((results) => {
            res.status(200).json(results.rows);
        })
        .catch((err) => {
            res.status(500).send(err);
        });
});

//get data from the DB
app.get('/locations', (req, res) => {
    const SQL = 'SELECT * FROM locations;';
    client
        .query(SQL)
        .then((results) => {
            res.status(200).json(results.rows);
        })
        .catch((err) => {
            res.status(500).send(err);
        });
});

app.use('*', notFoundHandler);
app.use(errorHandler);
// connect to our DB and create an event listener that would listen to errors if we have a problem with the url or psql is not running.
// if there are no errors it will connect to it, if there are it will throw an error
client
    .connect()
    .then(() => {
        app.listen(PORT, () =>
            console.log(`my server is up and running on port ${PORT}`)
        );
    })
    .catch((err) => {
        throw new Error(`startup error ${err}`);
    });