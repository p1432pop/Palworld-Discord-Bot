const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");
const { execFile } = require("child_process");
const dotenv = require("dotenv");
dotenv.config();
const mysql = require("mysql2/promise");
const pool = mysql.createPool({
	// DB connection pool 생성
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	connectionLimit: 5,
	multipleStatements: true,
});
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
let channel;
client.once("ready", () => {
	console.log("Ready!");
	channel = client.channels.cache.get(process.env.CHANNEL_ID);
});
client.on("messageCreate", async (message) => {
	if (message.author.bot) return;
	if (process.env.CHANNEL_ID === message.channelId && message.content.length > 0 && message.content.charAt(0) === "!") {
		if (message.content === "!start") {
			execFile("./scripts/is_running.sh", (error, stdout, stderr) => {
				if (error) {
					console.log(error, new Date());
				} else {
					if (stdout.length !== 1) {
						channel.send("이미 서버가 실행 중입니다.");
					} else {
						channel.send("서버를 시작합니다.");
						execFile("./scripts/start.sh", (error, stdout, stderr) => {});
					}
				}
			});
		} else if (message.content === "!stop") {
			channel.send("1분 뒤 서버가 중지됩니다.");
			execFile("./scripts/stop.sh", (error, stdout, stderr) => {
				if (error) {
					console.log(error, new Date());
					channel.send("서버 중지 실패");
				} else {
					console.log("stop", new Date());
					channel.send("서버가 중지되었습니다.");
				}
			});
		} else if (message.content === "!check") {
			execFile("./scripts/check.sh", (error, stdout, stderr) => {
				if (error) {
					console.log(error, new Date());
					channel.send("상태 확인 불가");
				} else {
					console.log("check", new Date());
					channel.send(`현재 서버의 메모리 사용률은 ${stdout}%입니다.`);
				}
			});
		} else if (message.content === "!help") {
			channel.send("-명령어 목록-\n!start       - 서버 시작\n!stop        - 서버 중지\n!check     - 서버 상태 확인\n!거점");
		} else if (message.content.split(" ")[0] === "!거점") {
			const command = message.content.split(" ")[1];
			if (message.content === "!거점 목록") {
				const sql = "select * from pal_user order by username asc, x asc";
				const con = await pool.getConnection();
				const [rows] = await con.query(sql);
				let result = "";
				for (let row of rows) {
					result += `No. ${row.num}, username: ${row.username}, x: ${row.x}, y: ${row.y}\n`;
				}
				if (result.length === 0) {
					channel.send("존재하는 거점이 없습니다.");
				} else {
					channel.send(result);
				}
				con.release();
			} else if (command === "추가") {
				const x = message.content.split(" ")[2];
				const y = message.content.split(" ")[3];
				if (message.content.split(" ").length === 4 && /^-?\d+$/.test(x) && /^-?\d+$/.test(y)) {
					const sql = `insert into pal_user(username, x, y) values ("${message.author.username}", ${x}, ${y})`;
					const con = await pool.getConnection();
					await con.query(sql);
					channel.send("성공적으로 추가되었습니다.");
					con.release();
				} else {
					channel.send("유효하지 않은 명령어입니다.\n!거점 추가 X Y   ex) !거점 추가 270 -162");
				}
			} else if (command === "삭제") {
				const num = message.content.split(" ")[2];
				if (message.content.split(" ").length === 3 && /^\d+$/.test(num)) {
					const sql = `delete from pal_user where num = ${num} AND username = "${message.author.username}"`;
					const con = await pool.getConnection();
					const [rows] = await con.query(sql);
					if (rows.affectedRows === 1) {
						channel.send("성공적으로 삭제되었습니다.");
					} else {
						channel.send("고유번호가 일치하지 않거나 본인의 거점만 삭제할 수 있습니다.");
					}
					con.release();
				} else {
					channel.send("유효하지 않은 명령어입니다.\n!거점 삭제 고유번호  ex) !거점 삭제 1");
				}
			} else if (message.content === "!거점") {
				channel.send("\n-명령어 목록-\n!거점 목록\n!거점 추가 X Y                   ex) !거점 추가 270 -162\n!거점 삭제 고유번호       ex) !거점 삭제 5");
			} else {
				channel.send("유효하지 않은 명령어입니다.\n-명령어 목록-\n!거점 목록\n!거점 추가 X Y                   ex) !거점 추가 270 -162\n!거점 삭제 고유번호       ex) !거점 삭제 5");
			}
		} else {
			channel.send("유효하지 않은 명령어입니다.\n-명령어 목록-\n!start       - 서버 시작\n!stop        - 서버 중지\n!check     - 서버 상태 확인\n!거점");
		}
	}
});

const start = cron.schedule(
	"6 12 * * *",
	() => {
		channel.send("서버를 시작합니다.");
		execFile("./scripts/start.sh", (error, stdout, stderr) => {});
	},
	{ scheduled: true }
);
const stop = cron.schedule(
	"4 12 * * *",
	() => {
		channel.send("서버 안정화를 위해 1분 뒤 서버가 재시작됩니다.");
		execFile("./scripts/stop.sh", (error, stdout, stderr) => {
			if (error) {
				console.log(error, new Date());
				channel.send("서버 중지 실패");
			} else {
				console.log("stop", new Date());
				channel.send("서버가 중지되었습니다.");
			}
		});
	},
	{ scheduled: true }
);
const check = cron.schedule(
	"*/10 * * * *",
	() => {
		execFile("./scripts/check.sh", (error, stdout, stderr) => {
			if (error) {
				console.log(error, new Date());
			} else {
				console.log(stdout, new Date());
				if (stdout > 90) {
					channel.send("메모리 과부하로 서버가 1분 뒤 중지됩니다.");
					execFile("./scripts/stop.sh", (error, stdout, stderr) => {
						if (error) {
							console.log(error, new Date());
						} else {
							channel.send("서버가 중지되었습니다. !start 명령어를 통해 재시작해주세요.");
						}
					});
				}
			}
		});
	},
	{ scheduled: true }
);

client.login(process.env.DISCORD_TOKEN);
