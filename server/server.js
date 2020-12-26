var fs = require('fs');
var path = require('path');
var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var ejs = require('ejs');

var app = express();

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

var http = require('http').Server(app);
var io = require('socket.io')(http);
// 채팅 socket.io,

var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'web2020',
	password : 'web2020',
	database : 'web'
});




//app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'my')));
app.use(express.static(path.join(__dirname, 'image')));
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

function restrict(req, res, next) {
  if (req.session.loggedin) {
    next();
  } else {
    req.session.error = 'You are not logged in';
    res.sendFile(path.join(__dirname + '/my/login.html'));
  }
}

app.use('/', function(request, response, next) {
	if ( request.session.loggedin == true || request.url == "/login" || request.url == "/register" ) {
    next();
	}
	else {
    response.sendFile(path.join(__dirname + '/my/login.html'));
	}
});

app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname + '/my/home.html'));
});

app.get('/login', function(request, response) {
	response.sendFile(path.join(__dirname + '/my/login.html'));
});

app.get('/homeimg', function(request, response) {
    if (request.session.loggedin) {
		response.sendFile(path.join(__dirname + '/my/home.html'));
	} else {
		response.send('Please login to view this page!');
        response.end();
    }
});

app.post('/login', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	if (username && password) {
		connection.query('SELECT * FROM user WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
			if (error) throw error;
			if (results.length > 0) {
				request.session.loggedin = true; // loggedin == true -> 로그인상태
				request.session.username = username;
                response.redirect('/home.html');
                console.log('User with [', request.connection.remoteAddress, '] IP is logged in.')
				response.end(); // 로그인시 IP 로그 남기기
			} else {
				response.sendFile(path.join(__dirname + '/my/loginerror.html'));
			}			
		});
	} else {
		
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.get('/register', function(request, response) {
	response.sendFile(path.join(__dirname + '/my/register.html'));
});

app.post('/register', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	var password2 = request.body.password2;
	var email = request.body.email;
	console.log(username, password, email);
	if (username && password && email) {
		connection.query('SELECT * FROM user WHERE username = ? AND password = ? AND email = ?', [username, password, email], function(error, results, fields) {
			if (error) throw error;
			if (results.length <= 0) {
        connection.query('INSERT INTO user (username, password, email) VALUES(?,?,?)', [username, password, email],
            function (error, data) {
                if (error)
                  console.log(error);
                else
                  console.log(data);
        });
			  response.send(username + ' Registered Successfully!<br><a href="/home">Home</a>');
			} else {
				response.send(username + ' Already exists!<br><a href="/home" target="_parent">Home</a>');
			}			
			response.end();
		});
	} else {
		response.send('Please enter User Information!');
		response.end();
	}
});

app.get('/logout', function(request, response) {
  request.session.loggedin = false;
	response.send('<center><H1>로그아웃 되었습니다 !</H1><H1><a href="/">로그인 하러가기</a></H1></center>');
	response.end();
});

app.get('/home', restrict, function(request, response) {
	if (request.session.loggedin) {
		response.sendFile(path.join(__dirname + '/my/home.html'));
	} else {
		response.send('Please login to view this page!');
		response.end();
	}
});



app.get('/test2', function(request, response) {
	if (request.session.loggedin) {
		response.sendFile(path.join(__dirname + '/my/test2.html'));
	} else {
		response.send('Please login to view this page!');
		response.end();
	}
});

var count=1;
io.on('connection', function(socket){
  console.log('user connected, socket id : ', socket.id);
  var name = "user" + count++;
  io.to(socket.id).emit('change name',name);

  socket.on('disconnect', function(){
    console.log('user disconnected, socket id: ', socket.id);
  });
  
  socket.on('send message', function(name,text){
    var msg = name + ' : ' + text;
    console.log(msg);
    io.emit('receive message', msg);
  });
});

// Board
app.get('/board', function (request, response) { 
    // ������ �н��ϴ�.
    fs.readFile(__dirname + '/board/list.html', 'utf8', function (error, data) {
        // �����ͺ��̽� ������ �����մϴ�.
        connection.query('SELECT * FROM products', function (error, results) {
            // �����մϴ�.
            response.send(ejs.render(data, {
                data: results
            }));
        });
    });
});
app.get('/delete/:id', function (request, response) { 
    // �����ͺ��̽� ������ �����մϴ�.
    connection.query('DELETE FROM products WHERE id=?', [request.param('id')], function () {
        // �����մϴ�.
        response.redirect('/board');
    });
});
app.get('/insert', function (request, response) {	
    // ������ �н��ϴ�.
    fs.readFile(__dirname + '/board/insert.html', 'utf8', function (error, data) {
        // �����մϴ�.
        response.send(data);
    });
});
app.post('/insert', function (request, response) {
    // ������ �����մϴ�.
    var body = request.body;

    // �����ͺ��̽� ������ �����մϴ�.
    connection.query('INSERT INTO products (name, modelnumber, series) VALUES (?, ?, ?)', [
        body.name, body.modelnumber, body.series
    ], function () {
        // �����մϴ�.
        response.redirect('/board');
    });
});
app.get('/edit/:id', function (request, response) {
	    // ������ �н��ϴ�.
    fs.readFile(__dirname + '/board/edit.html', 'utf8', function (error, data) {
        // �����ͺ��̽� ������ �����մϴ�.
        connection.query('SELECT * FROM products WHERE id = ?', [
            request.param('id')
        ], function (error, result) {
            // �����մϴ�.
            response.send(ejs.render(data, {
                data: result[0]
            }));
        });
    });
});
app.post('/edit/:id', function (request, response) {
	    // ������ �����մϴ�.
    var body = request.body

    // �����ͺ��̽� ������ �����մϴ�.
    connection.query('UPDATE products SET name=?, modelnumber=?, series=? WHERE id=?', [
        body.name, body.modelnumber, body.series, request.param('id')
    ], function () {
        // �����մϴ�.
        response.redirect('/board');
    });
});


http.listen('3000', function () {
    console.log('Server Start -> http://127.0.0.1:3000');
});