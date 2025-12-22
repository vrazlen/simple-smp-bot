use anyhow::Result;
use azalea::prelude::*;
use azalea_viaversion::ViaVersionPlugin;
use std::env;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, Duration};

#[derive(Clone, Component)]
struct State {
    inner: Arc<Mutex<InnerState>>,
}

impl Default for State {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(InnerState::default())),
        }
    }
}

#[derive(Default)]
struct InnerState {
    tick: u64,
    seed: u64,
    next_look: u64,
    next_action: u64,
    jump_until: u64,
    crouch_until: u64,
    spawned: bool,
    login_sent: bool,
    password: Option<String>,
}

fn lcg_next(seed: &mut u64) -> u32 {
    *seed = seed
        .wrapping_mul(6364136223846793005)
        .wrapping_add(1);
    (*seed >> 32) as u32
}

fn rand_range(seed: &mut u64, min: f32, max: f32) -> f32 {
    let value = lcg_next(seed);
    let t = (value as f32) / (u32::MAX as f32);
    min + (max - min) * t
}

fn init_seed() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x1234_5678)
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut host = env::var("BOT_HOST").unwrap_or_else(|_| "localhost".to_string());
    let mut port: u16 = env::var("BOT_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(25565);
    let mut username = env::var("BOT_USERNAME").unwrap_or_else(|_| "AFK_Bot".to_string());
    let password = env::var("BOT_PASSWORD").ok();
    let version = env::var("BOT_VERSION").unwrap_or_else(|_| "1.21.10".to_string());

    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        host = args[1].clone();
    }
    if args.len() > 2 {
        username = args[2].clone();
    }
    if args.len() > 3 {
        port = args[3].parse().unwrap_or(port);
    }

    println!("[RustBot] Target: {}:{}", host, port);
    println!("[RustBot] User: {}", username);
    println!("[RustBot] Version: {}", version);
    println!(
        "[RustBot] Password set: {}",
        if password.is_some() { "yes" } else { "no" }
    );

    let account = Account::offline(&username);
    let address = format!("{}:{}", host, port);
    let via = ViaVersionPlugin::start(version).await;

    let state = State {
        inner: Arc::new(Mutex::new(InnerState { password, ..Default::default() })),
    };

    ClientBuilder::new()
        .set_handler(handle)
        .set_state(state)
        .add_plugins(via)
        .start(account, address)
        .await;

    Ok(())
}

async fn handle(bot: Client, event: Event, state: State) -> Result<()> {
    match event {
        Event::Spawn => {
            let (password, should_send) = {
                let mut guard = state.inner.lock().unwrap();
                guard.spawned = true;
                if guard.seed == 0 {
                    guard.seed = init_seed();
                }
                guard.next_look = guard.tick + 100;
                guard.next_action = guard.tick + 300;
                println!("[RustBot] Spawned in world.");

                let should_send = !guard.login_sent && guard.password.is_some();
                if should_send {
                    guard.login_sent = true;
                }
                (guard.password.clone(), should_send)
            };

            if should_send {
                if let Some(pass) = password {
                    let bot_clone = bot.clone();
                    tokio::spawn(async move {
                        sleep(Duration::from_secs(2)).await;
                        bot_clone.chat(&format!("/login {}", pass));
                        sleep(Duration::from_secs(4)).await;
                        bot_clone.chat(&format!("/login {}", pass));
                    });
                    println!("[RustBot] Sending /login.");
                }
            }
        }
        Event::Chat(message) => {
            println!("[Chat] {}", message.message().to_ansi());
        }
        Event::Disconnect(reason) => {
            println!("[RustBot] Disconnected: {:?}", reason);
            let mut guard = state.inner.lock().unwrap();
            guard.spawned = false;
            guard.login_sent = false;
        }
        Event::Tick => {
            let mut guard = state.inner.lock().unwrap();
            if !guard.spawned {
                return Ok(());
            }

            guard.tick += 1;

            if guard.tick >= guard.next_look {
                if guard.seed == 0 {
                    guard.seed = init_seed();
                }
                let yaw = rand_range(&mut guard.seed, -90.0, 90.0);
                let pitch = rand_range(&mut guard.seed, -30.0, 30.0);
                bot.set_direction(yaw, pitch);
                guard.next_look = guard.tick + 100;
            }

            if guard.tick >= guard.next_action {
                if guard.seed == 0 {
                    guard.seed = init_seed();
                }
                if lcg_next(&mut guard.seed) % 2 == 0 {
                    bot.set_jumping(true);
                    guard.jump_until = guard.tick + 10;
                } else {
                    bot.set_crouching(true);
                    guard.crouch_until = guard.tick + 20;
                }
                let jitter = (lcg_next(&mut guard.seed) % 40) as u64;
                guard.next_action = guard.tick + 300 + jitter;
            }

            if guard.jump_until > 0 && guard.tick >= guard.jump_until {
                bot.set_jumping(false);
                guard.jump_until = 0;
            }

            if guard.crouch_until > 0 && guard.tick >= guard.crouch_until {
                bot.set_crouching(false);
                guard.crouch_until = 0;
            }
        }
        _ => {}
    }

    Ok(())
}
