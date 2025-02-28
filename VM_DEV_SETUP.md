Setup instructions for VM based development
===========================================

At the end of these instructions you should have a working VM that is running
camphoric. The development version of this VM is running the Django development
server as a service and has a pre-installed set of files to provide a
working frontend for testing.

If you want to do frontend development, you'll want to run the frontend server.
See `./vagrant-command-help` for some recommendations.

Using this setup, you should be able to edit and change files outside of the
VM, but those changes will immediately be applied therein. You should also run
all of your git commands outside of the VM.

Setup instructions for MacOS/Linux
----------------------------------

### 1. Install prereqs

You'll need to install the following:

- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)
- [Vagrant](https://developer.hashicorp.com/vagrant/docs/installation)
- [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
- [git](https://git-scm.com/downloads)

**MacOS**

On MacOS, this is most easily done with [Homebrew](https://brew.sh/). Once
Homebrew is installed, you'll then want to install the following using
Homebrew:

```
brew install ansible vagrant git
```

You'll also want to install
[VirtualBox](https://www.virtualbox.org/wiki/Downloads), which is best done
with its own installer.

**Linux**

On Linux, the process varies, but you'll want to use the package manager of
your distro. On Ubuntu/Debian distros, it'll be something like:

```
# must do this as root
sudo su
# install hashicorp's apt repo, see https://developer.hashicorp.com/vagrant/downloads
wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
# install 
apt-get install virtualbox ansible vagrant git
exit
```

### 2. Create and start your Vagrant VM

Once you've cloned the project, you'll want to go inside of the camphoric
directory and run `vagrant up`. This will create the VM and create some
settings and ssh keys to be used for this VM.

### 3. Test your camphoric installation

You should now have a [working copy of camphoric at http://localhost:8000](http://localhost:8000).

If you are doing frontend development you can start the server at
localhost:3000 using the following command:

`vagrant ssh -c "cd camphoric/client; npm start"`


Setup instructions for Windows
------------------------------

### 1. Install Windows Subsystem for Linux (wsl)

Instructions for installation can be found here:
https://learn.microsoft.com/en-us/windows/wsl/install

Modern development on Windows mostly works under this framework anyway. This
basically installs a linux distro in a specialized virtual environment for
Windows.

It's worth noting that you'll need to make sure that your systems supports
Hyper-V. This may involve changing certain hardware settings in your BIOS or UEFI.

- [Hyper-V system requirements](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/system-requirements-for-hyper-v-on-windows?pivots=windows#general-requirements)
- [Enable Virtualization on Windows](https://support.microsoft.com/en-us/windows/enable-virtualization-on-windows-c5578302-6e43-4b4b-a449-8ced115f58e1)

After you have this installed, there are a few settings that you'll need to
tweak inside your `/etc/wsl.conf` file:

```
[boot]
systemd=true

[automount]
enabled=true
options="metadata,unmask=22,fmask=11"
```

These changes will allow you to change permissions on mounted windows (DrvFs)
drives, which will be required to get Vagrant running correctly. For these
settings to take effect, you'll need to halt your wsl instance (`wsl --shutdown`)
and wait 8 seconds before starting it up again. Ensure that your wsl instance
is off by running `wsl --list --running` and seeing that there are no active
instances.

### 2. Install VirtualBox

Get VirtualBox here:
https://www.virtualbox.org/wiki/Downloads

You'll want to install Virtual Box on the Windows side of things, not inside of
your wsl installation. Wsl does not currently support running VirtualBox inside
of its own VM. Vagrant knows that this is the case and we will set up some env
variables to let it know.

### 3. Install Vagrant

You'll want to install vagrant on the wsl side of things, so it can easily be
done with apt. There are instructions about how to do that here:
https://developer.hashicorp.com/vagrant/install#linux

You'll also want to add some things to your `.profile` in order for things to
run smoother:

```
export VAGRANT_WSL_ENABLE_WINDOWS_ACCESS="1"
export PATH="$PATH:/mnt/c/Program Files/Oracle/VirtualBox"
export VAGRANT_WSL_WINDOWS_ACCESS_USER_HOME_PATH="/mnt/c/Users/your_windows_username_here"
```

[Additional docs on how to setup vagrant on wsl](https://developer.hashicorp.com/vagrant/docs/other/wsl)

### 4. Install Ansible

We use ansible to provision your VM. This is a step I have yet to test so YMMV.

```
sudo apt-add-repository ppa:ansible/ansible
sudo apt update
sudo apt install ansible
```

[source](https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-ansible-on-ubuntu-20-04)

### 5. Setup working folders inside of your Windows profile directory

Due to the limitations of Vagrant and VirtualBox, you'll need to have your code
stored on the mounted windows volume (usually at `/mnt/c`). I recommend you
create a subfolder inside of `/mnt/c/Users/your_windows_username_here`. This is
where you'll want to `git clone` the camphoric project.

### 6. Create and start your Vagrant VM

Once you've cloned the project, you'll want to go inside of the camphoric
directory and run `vagrant up`. This will create the VM and create some
settings and ssh keys to be used for this VM.

NOTE: you may need to change permissions on the `private_key` file inside of
the `.vagarant/` directory. The default permissions of this file may be too
permissive for ssh to use.

### 7. Test your camphoric installation

You should now have a [working copy of camphoric at http://localhost:8000](http://localhost:8000).

If you are doing frontend development you can start the server at
localhost:3000 using the following command:

`vagrant ssh -c "cd camphoric/client; npm start"`

