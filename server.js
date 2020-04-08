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
app.get('/weather', weatherHandler);
app.get('/trails', trailsHandler);
app.use('*', notFoundHandler);
app.use(errorHandler);


//make a new connection to the psql(DB) using the provided link by using the client method(from pg library)
const client = new pg.Client(process.env.DATABASE_URL);
client.on('error', (err) => {
    throw new Error(err);
});

function locationHandler(request, response) {

    const city = request.query.city;
    //get data from the DB
    const SQL = 'SELECT * FROM locations WHERE search_query = $1;';
    const safeValues = [city];
    client
        .query(SQL, safeValues)
        .then((results) => {
            // console.log('hello');

            if (results.rows.length > 0) {
                response.status(200).json(results.rows[0]) //cause it will be an array of only one element and it will return an object
            } else {
                superagent(
                        `https://eu1.locationiq.com/v1/search.php?key=${process.env.GEOCODE_API_KEY}&q=${city}&format=json`)
                    .then((res) => {
                        // console.log('bye')
                        const geoData = res.body;
                        const locationData = new Location(city, geoData);
                        //get data from the query and insert it to the DB
                        const SQL = 'INSERT INTO locations (search_query, formatted_query,latitude,longitude) VALUES ($1,$2,$3,$4) RETURNING *';
                        const safeValues = [locationData.search_query, locationData.formatted_query, locationData.latitude, locationData.longitude];
                        client.query(SQL, safeValues).then(results => {
                            response.status(200).json(results.rows[0]);
                        })
                    })
            }
        })
        .catch((error) => {
            errorHandler(error, request, response);
        })
}

function Location(city, geoData) {
    this.search_query = city;
    this.formatted_query = geoData[0].display_name;
    this.latitude = geoData[0].lat;
    this.longitude = geoData[0].lon;
}


function weatherHandler(request, response) {

    superagent(
            `https://api.weatherbit.io/v2.0/forecast/daily?city=${request.query.search_query}&key=${process.env.WEATHER_API_KEY}`
        )
        .then((weatherRes) => {
            // console.log(weatherRes);
            const weatherSummaries = weatherRes.body.data.map((day) => {
                return new Weather(day);
            });
            response.status(200).json(weatherSummaries);
        })
        .catch((err) => errorHandler(err, request, response));
}

function Weather(day) {
    this.forecast = day.weather.description;
    this.time = new Date(day.valid_date).toString().slice(0, 15);
}

function trailsHandler(request, response) {
    superagent(`https://hikingproject.com/data/get-trails?lat=${request.query.latitude}&lon=${request.query.longitude}&maxDistance=400&key=${process.env.TRAIL_API_KEY}`)
        .then((trailRes) => {
            console.log(trailRes);
            const trailsInfo = trailRes.body.trails.map((element) => { return new Trail(element) });
            response.status(200).json(trailsInfo);
        })

    .catch((err) => errorHandler(err, request, response));
}


function Trail(element) {
    this.name = element.name;
    this.location = element.location;
    this.length = element.length;
    this.stars = element.stars;
    this.star_votes = element.starVotes;
    this.summary = element.conditionDetails;
    this.trail_url = element.url;
    this.conditions = element.conditionStatus;
    this.condition_date = element.conditionDate.toString().slice(0, 9);
    this.condition_time = element.conditionDate.toString().slice(11, 8);

}


// connect to our DB and create an event listener that would listen to errors if we have a problem with the url or psql is not running.
// if there are no errors it will connect to it, if there are it will throw an error

function notFoundHandler(request, response) {
    response.status(404).send('huh?');
}

function errorHandler(error, request, response) {
    response.status(500).send(error);
}

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`App is listening on ${PORT}`));

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