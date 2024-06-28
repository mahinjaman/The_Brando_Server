require('dotenv').config();
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000;

// middleware

app.use(cors())
app.use(express.json())

// routes

app.get('/', (req, res) => {
    res.send('Hello Brando Your server is ready to serve')
})


// Mongodb 


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oqwbmox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {

    const roomsCollections = client.db('TheBrando').collection('rooms');
    const roomsFacilityCollections = client.db('TheBrando').collection('room_facility');
    const latestNewsCollections = client.db('TheBrando').collection('news');
    const testimonialsCollections = client.db('TheBrando').collection('testimonial');


    try {

        // get popular rooms

        app.get('/popular_rooms', async (req, res) => {
            const popularRooms = await roomsCollections.find()
            .limit(5)
            .toArray();
            res.send(popularRooms)
        })

        // get rooms from mongo_db

        app.get('/rooms', async (req, res) => {
            const page = parseInt(req.query.page);
            const limit = parseInt(req.query.limit);
            const skip = (page - 1) * limit;
            console.log(skip);
            const rooms = await roomsCollections.find()
                .skip(skip)
                .limit(limit)
                .toArray()
            res.send(rooms)
        })

        // get room facility from mongo_db
        app.get('/room_facility', async (req, res) => {
            const roomFacility = await roomsFacilityCollections.find().toArray();
            res.send(roomFacility)
        })

        // get news room mongodb

        app.get('/news', async (req, res) => {
            const latestNews = await latestNewsCollections.find().toArray();
            res.send(latestNews)
        })

        // get testimonials
        app.get('/testimonials', async (req, res) => {
            const testimonials = await testimonialsCollections.find().toArray();
            res.send(testimonials)
        })


        // get specific room
        app.get('/room/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await roomsCollections.findOne(query)
            res.send(result)
        })

        // get total_room count from mongodb
        app.get('/total_rooms', async (req, res) => {
            const count = await roomsCollections.countDocuments();
            console.log(count);
            res.send({ count })
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        console.log('connection Done');
    }
}
run().catch(console.dir);



// End Mongo Db




app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})