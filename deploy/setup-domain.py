"""Attach the photobooth to the existing HTTPS gateway; no credentials are printed."""
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
import urllib.request

DOMAIN = 'fotokartinirembang.com'
BASE_URL = 'https://' + DOMAIN
VPS_IP = '139.190.100.249'
ALIAS = 'photobooth-kartini'
MARKER = '# Managed by photobooth deploy/domain.sh'
BEGIN = '# BEGIN photobooth-domain'
END = '# END photobooth-domain'


class SetupError(Exception):
    pass


def run(args, *, input=None, cwd=None, timeout=120):
    try:
        return subprocess.run(args, input=input, cwd=cwd, text=True,
                              capture_output=True, check=True, timeout=timeout).stdout
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
        # Do not echo Compose config, container environments, or Caddy contents.
        raise SetupError('Perintah gagal: ' + ' '.join(args)) from error


def caddy_block():
    return f'''{BEGIN}
{DOMAIN} {{
    encode gzip zstd
    header {{
        X-Content-Type-Options nosniff
        Referrer-Policy no-referrer
        Permissions-Policy "camera=(self), microphone=(), geolocation=()"
    }}
    reverse_proxy {ALIAS}:8787
}}
www.{DOMAIN} {{
    redir {BASE_URL}{{uri}} 308
}}
{END}'''


def merge_caddy(original):
    count_begin, count_end = original.count(BEGIN), original.count(END)
    if count_begin != count_end or count_begin > 1:
        raise SetupError('Penanda domain di Caddyfile tidak konsisten; file tidak diubah.')
    if count_begin:
        outside = original[:original.index(BEGIN)] + original[original.index(END) + len(END):]
        if DOMAIN in outside:
            raise SetupError('Domain sudah ada di konfigurasi lain; file tidak diubah.')
        return original[:original.index(BEGIN)] + caddy_block() + original[original.index(END) + len(END):]
    if DOMAIN in original:
        raise SetupError('Domain sudah diatur manual di Caddyfile; file tidak diubah.')
    return original.rstrip() + '\n\n' + caddy_block() + '\n'


def override_content(network):
    return f'''{MARKER}
services:
  app:
    environment:
      PUBLIC_BASE_URL: {json.dumps(BASE_URL)}
    networks:
      default: {{}}
      domain_gateway:
        aliases:
          - {ALIAS}
networks:
  domain_gateway:
    external: true
    name: {json.dumps(network)}
'''


def check_dns():
    for name in (DOMAIN, 'www.' + DOMAIN):
        try:
            addresses = {row[4][0] for row in socket.getaddrinfo(name, 443, type=socket.SOCK_STREAM)}
        except OSError as error:
            raise SetupError('DNS belum bisa diakses: ' + name) from error
        if addresses != {VPS_IP}:
            raise SetupError(f'DNS {name} belum hanya mengarah ke {VPS_IP}. Periksa A/AAAA sebelum melanjutkan.')


def discover_gateway():
    ids = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.service=caddy']).split()
    gateways = []
    template = '{"id":"{{.Id}}","mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}},"project":{{json (index .Config.Labels "com.docker.compose.project")}}}'
    for cid in ids:
        info = json.loads(run(['docker', 'inspect', '-f', template, cid]))
        bindings = info['ports'] or {}
        if any(binding.get('HostPort') == '443' for binding in bindings.get('443/tcp') or []):
            gateways.append(info)
    if len(gateways) != 1:
        raise SetupError('Tidak ditemukan tepat satu Caddy utama di port 443; belum ada perubahan.')
    gateway = gateways[0]
    mounts = [m for m in gateway['mounts'] if m['Type'] == 'bind' and m['Destination'] == '/etc/caddy/Caddyfile']
    if len(mounts) != 1 or not Path(mounts[0]['Source']).is_file():
        raise SetupError('Lokasi Caddyfile utama tidak dapat dibaca; belum ada perubahan.')
    networks = list(gateway['networks'])
    preferred = str(gateway['project']) + '_default'
    if preferred in networks:
        network = preferred
    elif len(networks) == 1 and networks[0] not in ('host', 'none', 'bridge'):
        network = networks[0]
    else:
        raise SetupError('Jaringan Caddy utama ambigu; belum ada perubahan.')
    return gateway['id'], Path(mounts[0]['Source']), network


def verify_https():
    deadline = time.monotonic() + 120
    while True:
        try:
            for host in (DOMAIN, 'www.' + DOMAIN):
                with urllib.request.urlopen('https://' + host + '/api/health', timeout=8) as response:
                    health = json.load(response)
                    if response.status != 200 or health.get('ok') is not True or 'mode' not in health:
                        raise ValueError('Bukan health photobooth')
            return
        except (OSError, ValueError):
            if time.monotonic() >= deadline:
                raise SetupError('HTTPS domain belum lolos pemeriksaan dalam dua menit.')
            time.sleep(4)


def configure(root):
    root = Path(root)
    override = root / 'compose.override.yaml'
    previous_override = override.read_bytes() if override.exists() else None
    if previous_override is not None and not previous_override.startswith(MARKER.encode()):
        raise SetupError('compose.override.yaml sudah ada dan bukan buatan setup ini; tidak ditimpa.')
    for alternate in ('compose.override.yml', 'docker-compose.override.yml', 'docker-compose.override.yaml'):
        if (root / alternate).exists():
            raise SetupError('Sudah ada override Compose lain; belum ada perubahan.')
    if os.environ.get('COMPOSE_FILE'):
        raise SetupError('COMPOSE_FILE khusus sedang aktif; belum ada perubahan.')
    print('1/5 Memeriksa DNS dan Caddy utama...', flush=True)
    check_dns()
    cid, caddyfile, network = discover_gateway()
    original = caddyfile.read_bytes()
    candidate = merge_caddy(original.decode())
    if not os.access(caddyfile, os.W_OK):
        raise SetupError('Tidak bisa menulis Caddyfile. Jalankan: sudo bash deploy/domain.sh')
    # Validate through stdin before writing the bind-mounted file or recreating app.
    run(['docker', 'exec', '-i', cid, 'caddy', 'validate', '--config', '/dev/stdin', '--adapter', 'caddyfile'], input=candidate)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
    backup = root / 'backups' / ('domain-' + stamp)
    backup.mkdir(parents=True, mode=0o700)
    shutil.copy2(caddyfile, backup / 'Caddyfile')
    (backup / 'Caddyfile').chmod(0o600)
    if previous_override is not None:
        (backup / 'compose.override.yaml').write_bytes(previous_override)
    app_attempted = False
    caddy_attempted = False
    compose = ['docker', 'compose']
    try:
        print('2/5 Menyimpan koneksi jaringan dan alamat QR...', flush=True)
        override.write_text(override_content(network))
        run(compose + ['config', '--quiet'], cwd=root)
        effective = json.loads(run(compose + ['config', '--format', 'json'], cwd=root))
        service = effective['services']['app']
        if (service['environment'].get('PUBLIC_BASE_URL') != BASE_URL
                or ALIAS not in service.get('networks', {}).get('domain_gateway', {}).get('aliases', [])
                or effective.get('networks', {}).get('domain_gateway', {}).get('name') != network):
            raise SetupError('Override domain belum diterapkan oleh Compose; belum mengubah container.')
        print('3/5 Memperbarui photobooth dan menunggu status healthy...', flush=True)
        app_attempted = True
        run(compose + ['up', '-d', '--no-deps', '--no-build', '--wait', '--wait-timeout', '90', 'app'], cwd=root)
        print('4/5 Memuat domain pada Caddy utama...', flush=True)
        caddy_attempted = True
        # Write in place: replacing the inode would leave a file bind mount stale.
        caddyfile.write_text(candidate)
        visible = run(['docker', 'exec', cid, 'cat', '/etc/caddy/Caddyfile'])
        if visible != candidate:
            raise SetupError('Caddy belum membaca file domain yang baru.')
        run(['docker', 'exec', cid, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
        print('5/5 Memeriksa HTTPS dan sertifikat (hingga dua menit)...', flush=True)
        verify_https()
    except BaseException:
        print('Setup belum berhasil. Memulihkan konfigurasi sebelumnya...', flush=True)
        errors = []
        if caddy_attempted:
            try:
                caddyfile.write_bytes(original)
                run(['docker', 'exec', cid, 'caddy', 'reload', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
            except Exception:
                errors.append('Caddy utama')
        if previous_override is None:
            override.unlink(missing_ok=True)
        else:
            override.write_bytes(previous_override)
        if app_attempted:
            try:
                run(compose + ['up', '-d', '--no-deps', '--no-build', '--wait', '--wait-timeout', '90', 'app'], cwd=root)
            except Exception:
                errors.append('container photobooth')
        if errors:
            print('Pemulihan perlu diperiksa: ' + ', '.join(errors), flush=True)
        print('Backup: ' + str(backup), flush=True)
        raise
    print('Selesai: ' + BASE_URL, flush=True)
    print('QR memakai domain baru. Backup: ' + str(backup), flush=True)
    print('Pembaruan berikutnya tetap bisa memakai docker compose up seperti biasa.', flush=True)


if __name__ == '__main__':
    try:
        configure(Path(__file__).resolve().parent.parent)
    except KeyboardInterrupt:
        print('Setup dibatalkan.', file=sys.stderr)
        sys.exit(130)
    except (SetupError, OSError, ValueError, KeyError) as error:
        print('Setup berhenti: ' + str(error), file=sys.stderr)
        sys.exit(1)
