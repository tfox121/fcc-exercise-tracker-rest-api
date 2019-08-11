'use strict'

const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true })

var port = process.env.PORT || 3000

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const path = require('path')

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/views/index.html'))
})

const shortid = require('shortid')

// define Schemas and compile Model
const ExerciseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
})

const UserSchema = new mongoose.Schema({
  _id: { type: String, default: shortid.generate },
  username: { type: String, required: true },
  log: [ExerciseSchema]
})

const User = mongoose.model('User', UserSchema)

// add new user to database
const createUser = (userName) => {
  return new Promise((resolve, reject) => {
    var newUser = new User({
      username: userName
    })
    newUser.save((err, data) => {
      if (!err) {
        console.log('Creating user')
        resolve({ user: userName, _id: data.id })
      } else {
        console.log('User create error')
        reject(err)
      }
    })
  })
}

// return list of all users database objects
const listUsers = () => {
  return new Promise((resolve, reject) => {
    User.find({}).select('_id, username').exec((err, data) => {
      if (!err) {
        console.log('Listing users')
        resolve(data)
      } else {
        console.log('User list error')
        reject(err)
      }
    })
  })
}

// find user by id, return user database object
const findUser = (userId) => {
  return new Promise((resolve, reject) => {
    User.findById(userId).select('-log._id').exec((err, user) => {
      if (!err) {
        console.log('Finding user')
        resolve(user)
      } else {
        console.log('User find error')
        reject(err)
      }
    })
  })
}

// add new activity to user log, return new user database object
const addExercise = (user, newActivity) => {
  return new Promise((resolve, reject) => {
    user.log.push(newActivity)
    user.save((err, data) => {
      if (!err) {
        console.log('Adding to log')
        resolve(data)
      } else {
        console.log('Log add error')
        reject(err)
      }
    })
  })
}

// filter log from user databse object depending on dates & convert dates to string
const activityFilter = (data, from, to) => {
  return data.log
    .filter(item => item.date >= from && item.date <= to)
    .map(item => ({
      description: item.description,
      duration: item.duration,
      date: item.date.toDateString()
    }))
}

// create new user
app.post('/api/exercise/new-user', (req, res, next) => {
  createUser(req.body.username)
    .then(data => {
      res.json(data)
    }).catch(err => {
      next(err)
    })
})

// display list of users
app.get('/api/exercise/users', (req, res, next) => {
  listUsers()
    .then(data => {
      res.json(data)
    }).catch(err => {
      next(err)
    })
})

// add new activity to log
app.post('/api/exercise/add', (req, res, next) => {
  var newActivity = {
    description: req.body.description,
    duration: req.body.duration,
    date: req.body.date || undefined
  }
  findUser(req.body.userId)
    .then(data => {
      return addExercise(data, newActivity)
    }).then(data => {
      var newActivityLogged = data.log[data.log.length - 1]
      res.json({
        username: data.username,
        description: newActivityLogged.description,
        duration: newActivityLogged.duration,
        _id: data._id,
        date: newActivityLogged.date.toDateString()
      })
    }).catch(err => {
      console.log('Excercise add failed')
      next(err)
    })
})

// display exercise log of specific user
app.get('/api/exercise/log', (req, res, next) => {
  var from = Date.parse(req.query.from) || 0
  var to = Date.parse(req.query.to) || new Date()
  var limit = req.query.limit
  findUser(req.query.userId)
    .then(data => {
      var filteredLog = activityFilter(data, from, to)
      res.json({
        _id: data._id,
        username: data.username,
        count: filteredLog.slice(0, limit).length,
        log: filteredLog.slice(0, limit)
      })
    })
    .catch(err => {
      console.log(err)
      console.log('Exercise log failed')
      next(err)
    })
})

// tfox121 code ends here ###################################################################

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage
  if (err.code) {
    // mongoose validation error
    errCode = 400 // bad request
    // report the first validation error
    errMessage = err.message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
